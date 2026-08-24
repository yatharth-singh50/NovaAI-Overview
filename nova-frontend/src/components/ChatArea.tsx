import { useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage';
import type { Message } from './ChatMessage';

interface ChatAreaProps {
  messages: Message[];
  isStreaming?: boolean;
  streamingContent?: string;
  onRegenerateMessage?: (index: number) => void;
  onEditMessage?: (index: number, content: string) => void;
}

export default function ChatArea({ messages, isStreaming, streamingContent, onRegenerateMessage, onEditMessage }: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Calculate the exact indices for the most recent messages
  const lastUserIndex = messages.map(m => m.role).lastIndexOf('user');
  const lastAssistantIndex = messages.map(m => m.role).lastIndexOf('assistant');

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 nova-scrollbar">
      <div className="max-w-3xl mx-auto">
        {messages.map((msg, i) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            isLatest={i === messages.length - 1 && msg.role === 'assistant'}
            // Only pass the regenerate function if this is the LAST assistant message
            onRegenerate={i === lastAssistantIndex && onRegenerateMessage ? () => onRegenerateMessage(i) : undefined}
            // Only pass the edit function if this is the LAST user message
            onEdit={i === lastUserIndex && onEditMessage ? (content) => onEditMessage(i, content) : undefined}
          />
        ))}

        {/* Streaming indicator */}
        {isStreaming && (
          <div className="flex gap-3 mb-6 nova-fade-in max-w-[85%]">
            <div
              className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5"
              style={{
                background: 'linear-gradient(135deg, #1e1e3a 0%, #252542 100%)',
                border: '1px solid rgba(124,106,247,0.3)',
                boxShadow: '0 0 12px rgba(124,106,247,0.15)',
              }}
            >
              <NovaSpinner />
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-semibold text-[#7c6af7] mb-1.5 tracking-wider uppercase">
                Nova
              </p>
              {streamingContent ? (
                <p className="text-sm leading-relaxed text-[#c8c8e8] whitespace-pre-wrap">
                  {streamingContent}
                  <span className="inline-block w-0.5 h-4 bg-[#7c6af7] ml-0.5 animate-pulse align-middle" />
                </p>
              ) : (
                <div className="flex items-center gap-1 mt-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-[#7c6af7]"
                      style={{
                        animation: `nova-dot-bounce 1.2s ease-in-out infinite`,
                        animationDelay: `${i * 0.2}s`,
                      }}
                    />
                  ))}
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
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="rgba(124,106,247,0.2)" strokeWidth="2" />
      <path
        d="M8 2a6 6 0 0 1 6 6"
        stroke="#7c6af7"
        strokeWidth="2"
        strokeLinecap="round"
        style={{ animation: 'spin 0.8s linear infinite', transformOrigin: '8px 8px' }}
      />
    </svg>
  );
}