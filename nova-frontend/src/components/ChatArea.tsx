import { useEffect, useRef, useState } from 'react';
import { Brain, Globe, FileText, Monitor, Music, MessageSquare, Mail, Terminal, Wrench } from 'lucide-react';
import ChatMessage from './ChatMessage';
import type { Message } from './ChatMessage';
import ShinyText from '../ui/components/ShinyText';

interface ChatAreaProps {
  messages: Message[];
  isStreaming?: boolean;
  streamingContent?: string;
  activeTool?: string | null;
  onRegenerateMessage?: () => void;
  onEditMessage?: (id: string, content: string) => void;
  onQuickReply?: (text: string) => void;
}

const TOOL_MAP: Record<string, { text: string, icon: any }> = {
  'search_the_web': { text: "Searching the web...", icon: Globe },
  'search_news': { text: "Scanning recent news...", icon: Globe },
  'scrape_webpage': { text: "Reading webpage...", icon: FileText },
  'execute_os_action': { text: "Navigating system...", icon: Monitor },
  'play_spotify': { text: "Opening Spotify...", icon: Music },
  'message_discord': { text: "Opening Discord...", icon: MessageSquare },
  'draft_gmail': { text: "Drafting email...", icon: Mail },
  'send_gmail': { text: "Sending email...", icon: Mail },
  'run_terminal_command': { text: "Running command...", icon: Terminal },
  'check_system_status': { text: "Checking system...", icon: Wrench },
};

const DEFAULT_PHRASES = [
  "Thinking...", "Brainstorming...", "Pondering...", "Hallucinating...",
  "Connecting the dots...", "Crunching parameters...", "Consulting the void...", "Asking nearby stars...", "Analyzing quantum fluctuations..."
];

export default function ChatArea({ messages, isStreaming, streamingContent, activeTool, onRegenerateMessage, onEditMessage, onQuickReply }: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [randomDefaultPhrase, setRandomDefaultPhrase] = useState(DEFAULT_PHRASES[0]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, activeTool]);

  useEffect(() => {
    if (isStreaming) {
      setRandomDefaultPhrase(DEFAULT_PHRASES[Math.floor(Math.random() * DEFAULT_PHRASES.length)]);
    }
  }, [isStreaming]);

  // Group contiguous assistant messages into variants
  const groupedMessages: (Message & { variants: Message[] })[] = [];
  messages.forEach(msg => {
    if (msg.role === 'user') {
      groupedMessages.push({ ...msg, variants: [msg] });
    } else {
      const last = groupedMessages[groupedMessages.length - 1];
      if (last && last.role === 'assistant') {
        last.variants.push(msg);
      } else {
        groupedMessages.push({ ...msg, variants: [msg] });
      }
    }
  });

  const currentToolData = activeTool && TOOL_MAP[activeTool] 
    ? TOOL_MAP[activeTool] 
    : { text: randomDefaultPhrase, icon: Brain };
  const CurrentIcon = currentToolData.icon;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 nova-scrollbar">
      <div className="max-w-3xl mx-auto">
        {groupedMessages.map((group, i) => (
          <ChatMessage
            key={group.variants[0].id}
            message={group.variants[0]}
            variants={group.variants}
            isLatest={i === groupedMessages.length - 1 && group.role === 'assistant'}
            isStreaming={isStreaming} // NEW
            onQuickReply={onQuickReply} // NEW
            onRegenerate={i === groupedMessages.length - 1 && onRegenerateMessage ? onRegenerateMessage : undefined}
            onEdit={group.role === 'user' && onEditMessage ? (content) => onEditMessage(group.id, content) : undefined}
          />
        ))}

        {isStreaming && (
          <div className="flex gap-3 mb-6 nova-fade-in max-w-[85%]">
            <div
              className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5"
              style={{ background: 'linear-gradient(135deg, #1e1e3a 0%, #252542 100%)', border: '1px solid rgba(124,106,247,0.3)', boxShadow: '0 0 12px rgba(124,106,247,0.15)' }}
            >
              <NovaSpinner />
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-semibold text-[#7c6af7] mb-1.5 tracking-wider uppercase">Nova</p>
              {streamingContent ? (
                <p className="text-sm leading-relaxed text-[#c8c8e8] whitespace-pre-wrap">
                  {streamingContent}<span className="inline-block w-0.5 h-4 bg-[#7c6af7] ml-0.5 animate-pulse align-middle" />
                </p>
              ) : (
                <div className="flex items-center gap-2.5 mt-1 transition-all duration-300">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-[#1e1e38] border border-[#2a2a50]">
                    <CurrentIcon size={10} className="text-[#a78bfa] animate-pulse" />
                  </div>
                  <ShinyText key={currentToolData.text} text={currentToolData.text} speed={2} className="text-[13px] font-medium tracking-wide" color="#6b6b99" shineColor="#ffffff" />
                </div>
              )}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function NovaSpinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="rgba(124,106,247,0.2)" strokeWidth="2" /><path d="M8 2a6 6 0 0 1 6 6" stroke="#7c6af7" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite', transformOrigin: '8px 8px' }} /></svg>
  );
}