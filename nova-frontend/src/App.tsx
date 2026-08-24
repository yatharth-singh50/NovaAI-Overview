import { useState, useCallback, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import type { ChatSession } from './components/Sidebar';
import TopBar from './components/TopBar';
import ChatArea from './components/ChatArea';
import ChatInput from './components/ChatInput';
import WelcomeScreen from './components/WelcomeScreen';
import type { Message } from './components/ChatMessage';
import Gradient from './components/Gradient';

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function makeSession(firstMessage?: string): ChatSession {
  return {
    id: genId(),
    title: firstMessage || 'New Chat',
    preview: firstMessage ?? '',
    timestamp: new Date(),
  };
}

async function fetchNovaReply(
  userMessage: string,
  imageB64: string | undefined,
  pdfB64: string | undefined,
  isSuperNova: boolean,
  sessionId: string, 
  onChunk: (chunk: string) => void,
): Promise<void> {
  try {
    const hostname = window.location.hostname;
    const response = await fetch(`http://${hostname}:8000/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        prompt: userMessage, 
        session_id: sessionId, 
        image_b64: imageB64,
        pdf_b64: pdfB64,
        super_nova: isSuperNova
      })
    });

    if (!response.body) throw new Error("No response body received.");

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      onChunk(chunk);
    }
  } catch (error) {
    onChunk("\n\n⚠️ **Connection Error**: Network bridge failed. Check your IP and port.");
  }
}

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionMessages, setSessionMessages] = useState<Record<string, Message[]>>({});
  const [sessionMemories, setSessionMemories] = useState<Record<string, string>>({});
  
  // --- NEW: State for the Delete Confirmation Modal ---
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activeMessages = activeSessionId ? sessionMessages[activeSessionId] || [] : [];
  const isWelcome = !activeSessionId || activeMessages.length === 0;

  useEffect(() => {
    const hostname = window.location.hostname;
    fetch(`http://${hostname}:8000/api/sessions`)
      .then(res => res.json())
      .then(data => {
        const loadedSessions = data.sessions.map((s: any) => ({
          id: s.id,
          title: s.title,
          preview: s.title,
          timestamp: new Date(s.timestamp)
        }));
        setSessions(loadedSessions);

        const memories: Record<string, string> = {};
        data.sessions.forEach((s: any) => {
          if (s.memory) memories[s.id] = s.memory;
        });
        setSessionMemories(memories);
      })
      .catch(err => console.error("Database connection failed", err));
  }, []);

  useEffect(() => {
    if (activeSessionId && !sessionMessages[activeSessionId]) {
      const hostname = window.location.hostname;
      fetch(`http://${hostname}:8000/api/chat/${activeSessionId}`)
        .then(res => res.json())
        .then(data => {
          const msgs = data.messages.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: new Date(m.timestamp)
          }));
          setSessionMessages(prev => ({ ...prev, [activeSessionId]: msgs }));
        });
    }
  }, [activeSessionId]);

  const startNewChat = useCallback(() => {
    setActiveSessionId(null);
    setStreamingContent('');
    setIsStreaming(false);
  }, []);

  const syncMemory = async (sessionId: string) => {
    try {
      const hostname = window.location.hostname;
      const res = await fetch(`http://${hostname}:8000/api/memory/${sessionId}`);
      const data = await res.json();
      if (data.memory) {
        setSessionMemories((prev) => ({ ...prev, [sessionId]: data.memory }));
      }
    } catch (e) {
      console.error("Failed to sync memory", e);
    }
  };

  const handleSend = async (imageB64?: string, pdfInfo?: { b64: string; name: string }, isSuperNova: boolean = false) => {
    const text = inputValue.trim();
    if (!text && !imageB64 && !pdfInfo) return;
    if (isStreaming) return;

    setInputValue('');
    let currentSessionId = activeSessionId;
    const isFirstTurn = !currentSessionId;

    if (!currentSessionId) {
      // Temporarily name it while the AI thinks
      const newSession = makeSession("Generating title...");
      currentSessionId = newSession.id;
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(currentSessionId);
    }

    const userMsg: Message = {
      id: genId(),
      role: 'user',
      content: text || (pdfInfo ? `Please analyze the attached document: ${pdfInfo.name}` : "Analyze the attached file."),
      timestamp: new Date(),
      image: imageB64,
      pdfB64: pdfInfo?.b64,
      fileName: pdfInfo?.name,       
      fileType: pdfInfo ? 'pdf' : undefined
    };

    setSessionMessages((prev) => ({
      ...prev,
      [currentSessionId!]: [...(prev[currentSessionId!] || []), userMsg],
    }));

    setIsStreaming(true);
    let fullReplyText = '';

    // --- NEW: Background AI Title Generation ---
    if (isFirstTurn) {
      const hostname = window.location.hostname;
      fetch(`http://${hostname}:8000/api/chat/${currentSessionId}/title`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMsg.content })
      })
      .then(res => res.json())
      .then(data => {
        if (data.title) {
          setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, title: data.title } : s));
        }
      })
      .catch(err => console.error("Title generation failed", err));
    }

    await fetchNovaReply(text, imageB64, pdfInfo?.b64, isSuperNova, currentSessionId!, (chunk) => {
      fullReplyText += chunk;
      setStreamingContent(fullReplyText);
    });

    const assistantMsg: Message = {
      id: genId(),
      role: 'assistant',
      content: fullReplyText,
      timestamp: new Date(),
    };

    setSessionMessages((prev) => ({
      ...prev,
      [currentSessionId!]: [...(prev[currentSessionId!] || []), assistantMsg],
    }));

    setSessions((prev) =>
      prev.map((s) => (s.id === currentSessionId ? { ...s, preview: text || "File Upload" } : s))
    );

    setStreamingContent('');
    setIsStreaming(false);
    
    syncMemory(currentSessionId!);
  };

  const handleEdit = (index: number, content: string) => {
    if (isStreaming || !activeSessionId) return;
    setInputValue(content); 
    const currentMessages = sessionMessages[activeSessionId] || [];
    setSessionMessages((prev) => ({
      ...prev,
      [activeSessionId]: currentMessages.slice(0, index), 
    }));
  };

  const handleRegenerate = async (messageIndex: number) => {
    if (isStreaming || !activeSessionId) return;

    const currentMessages = sessionMessages[activeSessionId] || [];
    const userMessageObj = currentMessages[messageIndex - 1]; 
    if (!userMessageObj || userMessageObj.role !== 'user') return;

    const truncatedMessages = currentMessages.slice(0, messageIndex);
    
    setSessionMessages((prev) => ({
      ...prev,
      [activeSessionId]: truncatedMessages,
    }));

    setIsStreaming(true);
    let fullReplyText = '';

    await fetchNovaReply(userMessageObj.content, userMessageObj.image, userMessageObj.pdfB64, false, activeSessionId, (chunk) => {
      fullReplyText += chunk;
      setStreamingContent(fullReplyText);
    });

    const assistantMsg: Message = {
      id: genId(),
      role: 'assistant',
      content: fullReplyText,
      timestamp: new Date(),
    };

    setSessionMessages((prev) => ({
      ...prev,
      [activeSessionId]: [...truncatedMessages, assistantMsg],
    }));

    setStreamingContent('');
    setIsStreaming(false);
    syncMemory(activeSessionId);
  };

  // --- NEW: Triggers the Modal ---
  const handleDeleteSession = (id: string) => {
    setSessionToDelete(id);
  };

  // --- NEW: Actually Deletes from the Database ---
  const confirmDelete = async (id: string) => {
    try {
      const hostname = window.location.hostname;
      await fetch(`http://${hostname}:8000/api/chat/${id}`, {
        method: 'DELETE'
      });
      setSessions((prev) => prev.filter((s) => s.id !== id));
      setSessionMessages((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (activeSessionId === id) setActiveSessionId(null);
    } catch (err) {
      console.error("Failed to delete chat", err);
    }
    setSessionToDelete(null);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ background: '#0d0d14', color: '#c8c8e8' }}>
      <Gradient isWelcome={isWelcome} />
      
      {/* --- NEW: Sleek Delete Confirmation Modal --- */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#13131e] border border-[#2a2a50] p-6 rounded-2xl shadow-2xl max-w-sm w-full nova-fade-in">
            <h3 className="text-white text-lg font-bold mb-2">Delete Chat</h3>
            <p className="text-[#a0a0c8] text-sm mb-6">Are you sure you want to permanently delete this conversation? This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setSessionToDelete(null)} 
                className="px-4 py-2 rounded-lg text-sm font-medium text-[#c8c8e8] hover:bg-[#1e1e38] transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => confirmDelete(sessionToDelete)} 
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-500/80 hover:bg-red-500 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`transition-all duration-300 ease-in-out h-full flex-shrink-0 overflow-hidden ${sidebarOpen ? 'w-64 opacity-100' : 'w-0 opacity-0'}`}>
        <div className="w-64 h-full">
          <Sidebar 
            sessions={sessions} 
            activeSessionId={activeSessionId} 
            activeMemory={activeSessionId ? sessionMemories[activeSessionId] : ""} 
            onNewChat={startNewChat} 
            onSelectSession={setActiveSessionId} 
            onDeleteSession={handleDeleteSession}
          />
        </div>
      </div>
      <main className="flex-1 flex flex-col min-w-0 relative">
        <TopBar sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((o) => !o)} />
        {isWelcome ? (
          <div className="flex-1 flex flex-col justify-between items-center relative">
            <WelcomeScreen onSuggestionClick={(p) => setInputValue(p)} />
            <ChatInput value={inputValue} onChange={setInputValue} onSend={handleSend} isStreaming={isStreaming} />
          </div>
        ) : (
          <>
            <ChatArea 
              messages={activeMessages} 
              isStreaming={isStreaming} 
              streamingContent={streamingContent} 
              onRegenerateMessage={handleRegenerate}
              onEditMessage={handleEdit}
            />
            <ChatInput value={inputValue} onChange={setInputValue} onSend={handleSend} isStreaming={isStreaming} />
          </>
        )}
      </main>
    </div>
  );
}