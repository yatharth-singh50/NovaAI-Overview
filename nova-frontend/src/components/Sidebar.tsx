import { Plus, Database, ShieldCheck, MessageSquare, Trash2 } from 'lucide-react';
import novaLogo from '../assets/NovaAITransparent.png';

export interface ChatSession {
  id: string;
  title: string;
  preview: string;
  timestamp: Date;
}

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  activeMemory: string; // <-- NEW: Accept memory prop
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
}

export default function Sidebar({
  sessions,
  activeSessionId,
  activeMemory, // <-- NEW
  onNewChat,
  onSelectSession,
  onDeleteSession,
}: SidebarProps) {
  const grouped = groupByDate(sessions);

  return (
    <aside
      className="w-64 h-screen flex flex-col flex-shrink-0"
      style={{
        background: 'rgba(10, 10, 18, 0.92)',
        backdropFilter: 'blur(24px) saturate(160%)',
        WebkitBackdropFilter: 'blur(24px) saturate(160%)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        boxShadow: 'inset -1px 0 0 rgba(124,106,247,0.05)',
      }}
    >
      {/* ── Header with Borderless Glow Logo ── */}
      <div className="p-5 flex items-center gap-3 flex-shrink-0">
        <div className="flex-shrink-0 flex items-center justify-center">
          <img 
            src={novaLogo} 
            alt="Nova Logo" 
            className="w-10 h-10 object-contain drop-shadow-[0_0_15px_rgba(124,106,247,0.5)]" 
          />
        </div>
        <div>
          <h1 className="text-gray-100 font-bold text-lg leading-tight tracking-wide">Nova</h1>
          <p className="text-[#6b6b99] text-[11px] font-medium">Personal AI · Local</p>
        </div>
      </div>

      {/* New Chat */}
      <div className="px-3 flex-shrink-0">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm text-white transition-all duration-200"
          style={{
            background: 'linear-gradient(135deg, #7c6af7 0%, #6366f1 100%)',
            boxShadow: '0 4px 16px rgba(124,106,247,0.25)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              '0 4px 24px rgba(124,106,247,0.45)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              '0 4px 16px rgba(124,106,247,0.25)';
          }}
        >
          <Plus size={17} strokeWidth={2.5} />
          New Chat
        </button>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto px-3 mt-6 nova-scrollbar">
        {sessions.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare size={28} className="text-[#2a2a50] mx-auto mb-3" />
            <p className="text-[#4a4a6a] text-xs leading-relaxed">
              Your conversations will appear here
            </p>
          </div>
        ) : (
          Object.entries(grouped).map(([label, items]) => (
            <div key={label} className="mb-4">
              <p className="text-[10px] font-bold tracking-widest uppercase text-[#4a4a6a] px-2 mb-2">
                {label}
              </p>
              <div className="space-y-0.5">
                {items.map((s) => (
                  <SessionItem
                    key={s.id}
                    session={s}
                    isActive={s.id === activeSessionId}
                    onSelect={() => onSelectSession(s.id)}
                    onDelete={() => onDeleteSession(s.id)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Memory Panel */}
      <div className="px-3 mt-2 flex-shrink-0">
        <div className="flex items-center gap-2 mb-2 px-1">
          <Database size={12} className={activeMemory ? "text-[#7c6af7]" : "text-[#4a4a6a]"} />
          <h2 className="text-[#4a4a6a] text-[10px] font-bold tracking-wider uppercase">
            Session Memory
          </h2>
        </div>
        <div
          className="rounded-xl p-3 min-h-[60px]"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(8px)',
          }}
        >
          {/* --- NEW: Dynamic Memory Rendering --- */}
          <p className={`text-[11px] leading-relaxed ${activeMemory ? 'text-[#c8c8e8]' : 'text-[#4a4a6a]'}`}>
            {activeMemory || "Memory builds as you chat. Key context is surfaced automatically."}
          </p>
        </div>
      </div>

      {/* Status bar */}
      <div
        className="p-4 flex items-center justify-between flex-shrink-0"
        style={{ borderTop: '1px solid #1e1e38' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full bg-emerald-400"
            style={{
              boxShadow: '0 0 6px rgba(52,211,153,0.6)',
              animation: 'nova-pulse 3s ease-in-out infinite',
            }}
          />
          <span className="text-emerald-400 text-xs font-medium">Local & Private</span>
        </div>
        <button className="text-[#4a4a6a] hover:text-[#a0a0c8] transition-colors p-1">
          <ShieldCheck size={16} />
        </button>
      </div>
    </aside>
  );
}

function SessionItem({ session, isActive, onSelect, onDelete }: any) {
  return (
    <div
      className="group relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all duration-150"
      style={
        isActive
          ? { background: 'rgba(124,106,247,0.12)', border: '1px solid rgba(124,106,247,0.2)' }
          : { background: 'transparent', border: '1px solid transparent' }
      }
      onClick={onSelect}
    >
      <MessageSquare size={13} className={isActive ? 'text-[#7c6af7] flex-shrink-0' : 'text-[#4a4a6a] flex-shrink-0'} />
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium truncate ${isActive ? 'text-[#c8c8e8]' : 'text-[#6b6b99]'}`}>
          {session.title}
        </p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="opacity-0 group-hover:opacity-100 text-[#4a4a6a] hover:text-red-400 transition-all duration-150 flex-shrink-0 p-0.5"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

function groupByDate(sessions: ChatSession[]): Record<string, ChatSession[]> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const week = new Date(today.getTime() - 7 * 86400000);

  const groups: Record<string, ChatSession[]> = {};
  sessions.forEach((s) => {
    const d = new Date(s.timestamp.getFullYear(), s.timestamp.getMonth(), s.timestamp.getDate());
    let label: string;
    if (d >= today) label = 'Today';
    else if (d >= yesterday) label = 'Yesterday';
    else if (d >= week) label = 'This week';
    else label = 'Earlier';
    if (!groups[label]) groups[label] = [];
    groups[label].push(s);
  });
  return groups;
}