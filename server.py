from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
import sqlite3
import uuid
from datetime import datetime
import os
import sys
import io
from agent import NovaAgent

# --- FORCE UTF-8 ENCODING ---
# This ensures characters like '→' don't crash the program on Windows
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.detach(), encoding='utf-8')
if sys.stderr.encoding != 'utf-8':
    sys.stderr = io.TextIOWrapper(sys.stderr.detach(), encoding='utf-8')

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- SQLITE DATABASE INITIALIZATION ---
def init_db():
    conn = sqlite3.connect('nova_chats.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS sessions
                 (id TEXT PRIMARY KEY, title TEXT, updated_at TEXT, memory TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS messages
                 (id TEXT PRIMARY KEY, session_id TEXT, role TEXT, content TEXT, timestamp TEXT)''')
    conn.commit()
    conn.close()

init_db()

def save_message(session_id: str, role: str, content: str):
    conn = sqlite3.connect('nova_chats.db')
    c = conn.cursor()
    msg_id = str(uuid.uuid4())
    timestamp = datetime.now().isoformat()
    c.execute("INSERT INTO messages VALUES (?, ?, ?, ?, ?)", (msg_id, session_id, role, content, timestamp))
    conn.commit()
    conn.close()

def update_session(session_id: str, title: str = None, memory: str = None):
    conn = sqlite3.connect('nova_chats.db')
    c = conn.cursor()
    updated_at = datetime.now().isoformat()
    c.execute("SELECT id FROM sessions WHERE id=?", (session_id,))
    if not c.fetchone():
        c.execute("INSERT INTO sessions (id, title, updated_at, memory) VALUES (?, ?, ?, ?)", (session_id, title or "New Chat", updated_at, memory or ""))
    else:
        if title:
            c.execute("UPDATE sessions SET title=?, updated_at=? WHERE id=?", (title, updated_at, session_id))
        elif memory is not None:
            c.execute("UPDATE sessions SET memory=?, updated_at=? WHERE id=?", (memory, updated_at, session_id))
        else:
            c.execute("UPDATE sessions SET updated_at=? WHERE id=?", (updated_at, session_id))
    conn.commit()
    conn.close()

# --- API MODELS & STATE ---
class ChatRequest(BaseModel):
    prompt: str
    session_id: str = "default"
    image_b64: str | None = None
    pdf_b64: str | None = None
    super_nova: bool = False

class TitleRequest(BaseModel):
    prompt: str

active_sessions = {}

# --- ENDPOINTS ---
@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    session_id = request.session_id
    
    update_session(session_id)
    save_message(session_id, "user", request.prompt or "Attached a file.")
    
    if session_id not in active_sessions:
        active_sessions[session_id] = NovaAgent()
        
    agent = active_sessions[session_id]

    def generate():
        full_response = ""
        try:
            for chunk in agent.chat_stream(request.prompt, request.image_b64, request.pdf_b64, request.super_nova):
                if chunk:
                    full_response += chunk
                    yield chunk
            
            save_message(session_id, "assistant", full_response)
            update_session(session_id, memory=agent.get_session_summary())
            
        except Exception as e:
            yield f"\n\n[Backend Error]: {str(e)}"

    return StreamingResponse(generate(), media_type="text/plain")

@app.post("/api/chat/{session_id}/title")
def generate_title(session_id: str, request: TitleRequest):
    try:
        import ollama
        response = ollama.generate(
            model="qwen2.5:3b",
            prompt=f"Create a very short (2 to 4 words) title for a chat that starts with this message: '{request.prompt}'. Do not use quotes, punctuation, or conversational filler. Just output the title.",
            options={"temperature": 0.3, "num_predict": 10}
        )
        title = response.get("response", "").strip().replace('"', '')
        if not title:
            title = "New Chat"
            
        update_session(session_id, title=title)
        return {"title": title}
    except Exception:
        return {"title": "New Chat"}

@app.delete("/api/chat/{session_id}")
def delete_chat(session_id: str):
    conn = sqlite3.connect('nova_chats.db')
    c = conn.cursor()
    c.execute("DELETE FROM sessions WHERE id=?", (session_id,))
    c.execute("DELETE FROM messages WHERE session_id=?", (session_id,))
    conn.commit()
    conn.close()
    
    if session_id in active_sessions:
        del active_sessions[session_id]
        
    return {"status": "success"}

@app.get("/api/sessions")
def get_sessions():
    conn = sqlite3.connect('nova_chats.db')
    c = conn.cursor()
    c.execute("SELECT id, title, updated_at, memory FROM sessions ORDER BY updated_at DESC")
    sessions = [{"id": row[0], "title": row[1], "timestamp": row[2], "memory": row[3]} for row in c.fetchall()]
    conn.close()
    return {"sessions": sessions}

@app.get("/api/chat/{session_id}")
def get_chat_history(session_id: str):
    conn = sqlite3.connect('nova_chats.db')
    c = conn.cursor()
    c.execute("SELECT id, role, content, timestamp FROM messages WHERE session_id=? ORDER BY timestamp ASC", (session_id,))
    messages = [{"id": row[0], "role": row[1], "content": row[2], "timestamp": row[3]} for row in c.fetchall()]
    conn.close()
    
    if session_id not in active_sessions and messages:
        agent = NovaAgent()
        history = [{"role": "system", "content": agent.conversation_history[0]["content"]}]
        for msg in messages[-10:]:
            history.append({"role": msg["role"], "content": msg["content"]})
        agent.conversation_history = history
        active_sessions[session_id] = agent
        
    return {"messages": messages}

@app.get("/api/memory/{session_id}")
def get_memory(session_id: str):
    conn = sqlite3.connect('nova_chats.db')
    c = conn.cursor()
    c.execute("SELECT memory FROM sessions WHERE id=?", (session_id,))
    row = c.fetchone()
    conn.close()
    return {"memory": row[0] if row else ""}

# --- HOST THE REACT UI ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

PACKAGED_DIST = os.path.join(BASE_DIR, "dist")
DEV_DIST = os.path.join(BASE_DIR, "nova-frontend", "dist")

DIST_DIR = PACKAGED_DIST if os.path.exists(PACKAGED_DIST) else DEV_DIST

print(f"Serving frontend from: {DIST_DIR}")

if os.path.exists(os.path.join(DIST_DIR, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST_DIR, "assets")), name="assets")

@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    if full_path.startswith("api/"):
        return {"error": "API route not found"}
    index_path = os.path.join(DIST_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"error": f"Frontend not found at: {index_path}"}

# THIS IS THE CRITICAL CHANGE
if __name__ == "__main__":
    print("DEBUG: Starting Uvicorn...")
    # Using the string reference for the app is much safer for internal execution
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)