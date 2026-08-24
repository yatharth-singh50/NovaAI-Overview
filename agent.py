import ollama
import os
import json
import base64
import fitz  # PyMuPDF
from datetime import datetime
from tools import AVAILABLE_TOOLS, search_the_web, scrape_webpage, check_system_status, search_images, search_news, get_system_telemetry, execute_os_action, save_to_memory, run_terminal_command, type_in_notepad, draft_gmail, send_gmail, play_spotify, message_discord

FAST_MODEL = "qwen2.5:3b" 
DEEP_MODEL = "llama3.1:8b" # SUPERNOVA
MAX_HISTORY_TURNS = 6       
SUMMARY_KEEP_TURNS = 2      

SYSTEM_PROMPT = r"""You are Nova, an intelligent personal AI copilot running locally on the user's machine.

IDENTITY:
* You are inspired by Marvel's FRIDAY: capable, proactive, technically skilled, reliable, and personable.
* Your goal is to help the user efficiently accomplish tasks, solve problems, learn new things, and stay informed.
* You behave like a trusted executive assistant, researcher, engineer, and operations partner combined into one system.
* You are designed to be useful first and impressive second.
* You are also conversational, do not always be short and direct, you can be brief and also give your opinions during a discussion.

PERSONALITY & TONE:
* Speak naturally and conversationally. Be intelligent without sounding arrogant.
* Be confident without sounding dismissive.
* Be friendly, attentive, and approachable while remaining professional.
* You may occasionally use light sarcasm, dry humor, or witty remarks when appropriate, but never at the user's expense.
* Remain calm and composed during troubleshooting, research, and problem-solving.

COMMUNICATION STYLE:
* Lead with the answer. Be concise when the task is simple.
* Be detailed when additional detail improves the outcome.
* Prefer concrete explanations over vague summaries.
* Write formal mathematics, engineering, and physics equations using LaTeX syntax: $$ E = mc^2 $$.

KNOWLEDGE & COPILOT CAPABILITIES:
* You are an OS Agent. You HAVE permission to control the computer using your tools when requested.
* You have a persistent Core Memory file (`memory.txt`) that contains the user's permanent preferences.

STRICT ACCURACY RULE:
* Your internal recall for real-world facts is UNRELIABLE. Use `search_the_web` or `search_news` for facts, history, or specs before answering.
* DO NOT autocorrect specific nouns in search queries.
* ALWAYS prefer latest data.

TOOL DISCIPLINE & OS CONTROL:
1. NEVER trigger OS tools UNLESS explicitly commanded.
2. TRANSLATION RULE: ONLY provide the direct translation. DO NOT explain acronyms.
3. `play_spotify`: Use this to play a specific song on Spotify.
4. `message_discord`: Use this to open Discord and message someone.
5. `type_in_notepad`: Use this to open Notepad and write text/code.
6. `draft_gmail` / `send_gmail`: Use these to draft and send emails (always ask for confirmation before sending).
7. `execute_os_action`: Use this ONLY to search the browser or launch Google Chrome.
  - If opening a specific Chrome profile, check CORE USER MEMORY. If unknown, ask the user for the profile name and use `save_to_memory`.
8. CLOSING RULE: After you successfully use a tool, you MUST output a final conversational message. Never output an empty string.

REASONING & DECISION MAKING:
* Think like a senior engineer, analyst, and research assistant.
* Distinguish facts, assumptions, and speculation clearly.
* Do not present guesses as established facts.

DEFAULT RESPONSE PHILOSOPHY:
* Answer first. Explain second. Help proactively.
"""

class NovaAgent:
    def __init__(self):
        self.memory_file = "memory.txt"
        core_memory = ""
        
        if os.path.exists(self.memory_file):
            with open(self.memory_file, "r", encoding="utf-8") as f:
                core_memory = f.read().strip()
                
        # --- THE FIX: Inject real-world context dynamically ---
        now = datetime.now().strftime("%A, %B %d, %Y at %I:%M %p")
        
        boot_prompt = SYSTEM_PROMPT + f"\n\n--- REAL-WORLD CONTEXT ---\nCurrent Date & Time: {now}\nPhysical Location: Bengaluru, Karnataka, India\n--------------------------"
        
        if core_memory:
            boot_prompt += f"\n\n--- CORE USER MEMORY & PROJECTS ---\n{core_memory}\n-----------------------------------"
            
        self.conversation_history = [{"role": "system", "content": boot_prompt}]
        self.turn_count = 0
        self.session_summary = ""

    def chat_stream(self, user_input: str, image_b64: str = None, pdf_b64: str = None, use_supernova: bool = False):
        active_model = DEEP_MODEL if use_supernova else FAST_MODEL

        # Handle PDF Extraction seamlessly in memory
        if pdf_b64:
            try:
                print("\n[Nova Memory Manager: Ripping text from PDF payload...]")
                pdf_data = base64.b64decode(pdf_b64.split(",")[1] if "," in pdf_b64 else pdf_b64)
                doc = fitz.open(stream=pdf_data, filetype="pdf")
                pdf_text = ""
                for page in doc:
                    pdf_text += page.get_text()
                
                # Protect context limits
                if len(pdf_text) > 20000:
                    pdf_text = pdf_text[:20000] + "\n...[CONTENT TRUNCATED FOR CONTEXT LIMITS]"
                    
                user_input = f"[SYSTEM: The user attached a PDF document. Extracted text below:]\n{pdf_text}\n\nUser Message: {user_input}"
            except Exception as e:
                yield f"⚠️ *PDF extraction failed: {str(e)}*\n\n"

        # Handle Vision Model Hot-Swapping
        if image_b64:
            clean_b64 = image_b64.split(",")[1] if "," in image_b64 else image_b64
            try:
                print(f"\n[Nova VRAM Manager: Explicitly evicting '{active_model}' to clear VRAM...]")
                ollama.generate(model=active_model, prompt='', keep_alive=0)
                print("[Nova VRAM Manager: Loading 'minicpm-v' (8B) into active memory...]")
                
                vision_prompt = (
                    f"Task 1: Extract all text from this image exactly as written.\n"
                    f"Task 2: If the text is not in English, provide the direct English translation. Do not guess acronyms.\n"
                    f"Task 3: Briefly describe the visual layout.\n"
                    f"User's specific request: '{user_input}'"
                )

                vision_res = ollama.generate(
                    model='minicpm-v',
                    prompt=vision_prompt,
                    images=[clean_b64],
                    keep_alive=0 
                )
                print("[Nova VRAM Manager: MiniCPM-V processing complete. Memory wiped.]")
                
                image_description = vision_res.get("response", "Could not extract visual data.")
                user_input = f"[SYSTEM: The user attached an image. VISION MODULE REPORT:\n{image_description}]\n\nUser Message: {user_input}"
            except Exception as e:
                yield f"⚠️ *Vision module failed to load: {str(e)}*\n\n"

        self.conversation_history.append({"role": "user", "content": user_input})
        self.turn_count += 1

        if len(self.conversation_history) > MAX_HISTORY_TURNS * 2:
            self._compress_memory(active_model)

        try:
            max_research_depth = 10
            depth = 0
            
            while depth < max_research_depth:
                print(f"\n[Nova VRAM Manager: Waking up '{active_model}'...]")
                response = ollama.chat(
                    model=active_model,
                    messages=self.conversation_history,
                    tools=[search_the_web, scrape_webpage, check_system_status, search_images, search_news, get_system_telemetry, execute_os_action, save_to_memory, run_terminal_command, type_in_notepad, draft_gmail, send_gmail, play_spotify, message_discord],
                    options={
                        "num_ctx": 4096 if use_supernova else 3072,
                        "num_predict": 1024,
                        "temperature": 0.2 if use_supernova else 0.1
                    }
                )
                
                if response.message.tool_calls:
                    self.conversation_history.append(response.message)
                    for tool in response.message.tool_calls:
                        func_name = tool.function.name
                        func_args = tool.function.arguments
                        if func_name in AVAILABLE_TOOLS:
                            tool_output = AVAILABLE_TOOLS[func_name](**func_args)
                        else:
                            tool_output = json.dumps({"error": f"Tool '{func_name}' not found."})
                            
                        self.conversation_history.append({
                            "role": "tool",
                            "name": func_name,
                            "content": tool_output,
                        })
                    depth += 1
                    continue
                else:
                    final_text = response.message.content or ""
                    self.conversation_history.append(response.message)
                    
                    if not final_text.strip():
                        if depth > 0:
                            final_text = "Done! I have completed the requested action."
                        else:
                            final_text = "⚠️ Context limits hit. Try a 'New Chat'."

                    chunk_size = 20
                    for i in range(0, len(final_text), chunk_size):
                        yield final_text[i:i + chunk_size]
                    return
            yield "⚠️ I searched the web extensively but hit my research limit. Try rephrasing your question."
        except Exception as e:
            yield f"⚠️ Operational Error: {str(e)}"

    def _compress_memory(self, model_name):
        try:
            recent_context = self.conversation_history[-SUMMARY_KEEP_TURNS:]
            compression_prompt = [{
                "role": "system",
                "content": f"Summarize key updates from this conversation into a brief paragraph. Existing short-term memory: {self.session_summary}\n\nContext:\n{json.dumps(self.conversation_history)}"
            }]
            summary_res = ollama.chat(model=model_name, messages=compression_prompt, options={"num_ctx": 1024})
            self.session_summary = summary_res.message.content or ""
            
            self.conversation_history = [
                {"role": "system", "content": self.conversation_history[0]["content"]}, 
                {"role": "system", "content": f"Short-term Session Recap: {self.session_summary}"}
            ] + recent_context
        except Exception:
            pass

    def get_session_summary(self) -> str:
        return self.session_summary

    def reset(self):
        if len(self.conversation_history) > 0:
            self.conversation_history = [self.conversation_history[0]]
        else:
            self.conversation_history = [{"role": "system", "content": SYSTEM_PROMPT}]
        self.turn_count = 0
        self.session_summary = ""