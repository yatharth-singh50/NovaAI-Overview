import { useState, useEffect } from 'react';
import { Copy, RotateCcw, ThumbsUp, ThumbsDown, Check, Edit2, FileText, ChevronLeft, ChevronRight, Mail, Send } from 'lucide-react';
import novaLogo from '../assets/NovaAITransparent.png';

export type MessageRole = 'user' | 'assistant';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  image?: string; 
  fileName?: string; 
  fileType?: string; 
  pdfB64?: string;
  variants?: Message[]; // Accepts grouped variants
}

interface ChatMessageProps {
  message: Message;
  variants?: Message[];
  isLatest?: boolean;
  isStreaming?: boolean;
  onRegenerate?: () => void;
  onEdit?: (content: string) => void;
  onQuickReply?: (text: string) => void;
}

// ... Keep your CodeBlock function exactly the same here ...
function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="my-4 rounded-xl overflow-hidden border border-[#2a2a50] bg-[#0a0a0f] shadow-lg">
      <div className="bg-[#13131e] px-4 py-2 text-[11px] font-mono text-[#6b6b99] border-b border-[#2a2a50] flex justify-between items-center">
        <span className="uppercase tracking-widest">{lang || 'plaintext'}</span>
        <button onClick={handleCopy} className="flex items-center gap-1.5 hover:text-[#c8c8e8] transition-colors">
          {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-4 text-[13px] leading-relaxed font-mono text-[#a2a2d0] overflow-x-auto whitespace-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ... Keep your formatMessageContent function exactly the same here ...
function formatMessageContent(text: string) {
  if (!text) return null;
  let safeText = text;
  if ((safeText.match(/```/g) || []).length % 2 !== 0) safeText += '\n```'; 
  const parts = safeText.split(/(```[\s\S]*?```)/g);

  return parts.map((part, index) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const match = part.match(/```([^\n]*)\n([\s\S]*?)```/);
      const lang = match ? match[1].trim() : '';
      const code = match ? match[2] : part.slice(3, -3);
      return <CodeBlock key={`code-${index}`} lang={lang} code={code.trim()} />;
    }

    const lines = part.split('\n');
    return lines.map((line, lineIdx) => {
      if (!line.trim()) return <div key={`space-${index}-${lineIdx}`} className="h-2" />;

      const headerMatch = line.match(/^(#{1,4})\s+(.*)/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        const styles = level === 1 ? 'text-xl mb-3' : level === 2 ? 'text-lg mb-2' : 'text-base mb-1';
        return <p key={`h-${index}-${lineIdx}`} className={`${styles} font-bold text-white mt-4`}>{headerMatch[2]}</p>;
      }

      const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)/);
      const contentToParse = listMatch ? listMatch[3] : line;

      const inlineRegex = /(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g;
      const tokens = contentToParse.split(inlineRegex);

      const elements = tokens.map((token, tIdx) => {
        if (token.startsWith('**') && token.endsWith('**')) {
          return <strong key={tIdx} className="font-bold text-white">{token.slice(2, -2)}</strong>;
        }
        if (token.startsWith('`') && token.endsWith('`')) {
          return <code key={tIdx} className="px-1.5 py-0.5 mx-0.5 rounded font-mono text-[12px] bg-[#252542] text-[#a78bfa]">{token.slice(1, -1)}</code>;
        }
        const linkMatch = token.match(/\[(.*?)\]\((.*?)\)/);
        if (linkMatch) {
          return <a key={tIdx} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-[#60a5fa] underline">{linkMatch[1]}</a>;
        }
        return <span key={tIdx}>{token}</span>;
      });

      if (listMatch) {
        const isNumbered = /\d+\./.test(listMatch[2]);
        return (
          <div key={`list-${index}-${lineIdx}`} className="flex items-start gap-2.5 my-1.5">
            <span className={`flex-shrink-0 font-bold ${isNumbered ? 'text-[#c8c8e8] text-[13px] mt-[1px]' : 'text-[#7c6af7] text-[10px] mt-[5px]'}`}>
              {isNumbered ? listMatch[2] : '●'}
            </span>
            <p className="text-[14px] leading-relaxed text-[#c8c8e8] flex-1">{elements}</p>
          </div>
        );
      }

      return <p key={`p-${index}-${lineIdx}`} className="text-[14px] leading-relaxed text-[#c8c8e8]">{elements}</p>;
    });
  });
}

export default function ChatMessage({ message, variants, isLatest, isStreaming, onRegenerate, onEdit, onQuickReply }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  
  const safeVariants = variants || [message];
  const [vIdx, setVIdx] = useState(safeVariants.length - 1);
  
  useEffect(() => {
    setVIdx(safeVariants.length - 1);
  }, [safeVariants.length]);

  const activeMessage = safeVariants[vIdx];
  const isUser = activeMessage.role === 'user';

  // --- NEW: Parse the confirmation tag ---
  const rawContent = activeMessage.content;
  const hasConfirmTag = rawContent.includes('[[CONFIRM_SEND]]');
  const displayContent = rawContent.replace(/\[\[CONFIRM_SEND\]\]/g, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(displayContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isUser) {
    return (
      <div className="flex justify-end mb-6 nova-fade-in group">
        <div className="max-w-[75%] flex flex-col items-end">
          {activeMessage.fileName && (
            <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-[#1e2a4a]/80 rounded-xl border border-[#3b82f6]/30 shadow-sm self-end">
              <div className="bg-red-500/20 p-1.5 rounded-md flex items-center justify-center">
                <FileText size={14} className="text-red-400" />
              </div>
              <span className="text-xs text-[#c8d8e8] font-medium max-w-[200px] truncate">{activeMessage.fileName}</span>
            </div>
          )}

          <div className="px-4 py-3 rounded-2xl rounded-tr-sm text-[14px] leading-relaxed text-white shadow-md flex flex-col gap-2" style={{ background: 'linear-gradient(135deg, #2d2a5e 0%, #1e1e3a 100%)', border: '1px solid rgba(124, 106, 247, 0.15)' }}>
            {activeMessage.image && (
              <img src={activeMessage.image} alt="Attachment" className="max-w-full max-h-64 object-contain rounded-lg border border-[#7c6af7]/30" />
            )}
            {activeMessage.content}
          </div>
          
          <div className="flex items-center gap-3 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {onEdit && (
              <button onClick={() => onEdit(activeMessage.content)} className="flex items-center gap-1 text-[#6b6b99] hover:text-[#c8c8e8] transition-colors" title="Edit Prompt">
                <Edit2 size={12} /> <span className="text-[10px]">Edit</span>
              </button>
            )}
            <button onClick={handleCopy} className="text-[#6b6b99] hover:text-[#c8c8e8] transition-colors" title="Copy">
              {copied ? <Check size={12} className="text-emerald-400"/> : <Copy size={12} />}
            </button>
            <p className="text-right text-[10px] font-medium text-[#4a4a6a]">
              {new Date(activeMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-4 mb-6 nova-fade-in group max-w-[85%]">
      <div className="w-10 h-10 flex-shrink-0 mt-0.5 flex items-start justify-center">
        <img src={novaLogo} alt="Nova" className="w-8 h-8 object-contain drop-shadow-[0_0_12px_rgba(124,106,247,0.5)]" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <p className="text-[11px] font-bold text-[#7c6af7] tracking-wider uppercase">Nova</p>
        </div>
        
        <div className="space-y-1.5">
          {formatMessageContent(activeMessage.content)}
        </div>

        {/* NEW: Dynamic Email Confirmation Component */}
        {hasConfirmTag && isLatest && !isStreaming && (
          <div className="mt-4 mb-2 p-3.5 bg-[#1e2a4a]/40 border border-[#3b82f6]/30 rounded-xl flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#3b82f6]/20 rounded-lg">
                <Mail className="text-[#60a5fa]" size={18} />
              </div>
              <div>
                <p className="text-[13px] text-white font-semibold">Ready to send email?</p>
                <p className="text-[11px] text-[#8a9cc0]">Draft is open in Chrome.</p>
              </div>
            </div>
            <button 
              onClick={() => onQuickReply && onQuickReply("The draft is perfect. Please execute the dispatch_gmail tool to open Chrome and send it now.")}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#3b82f6] to-[#2563eb] hover:from-[#60a5fa] hover:to-[#3b82f6] text-white text-xs font-bold rounded-lg shadow-md transition-all duration-200"
            >
              <Send size={14} /> Send Now
            </button>
          </div>
        )}

        <div className={`flex items-center gap-2 mt-3 transition-opacity duration-300 ${isLatest ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          
          {/* Arrow Version Navigator */}
          {safeVariants.length > 1 && (
            <div className="flex items-center gap-1.5 mr-1 text-[#6b6b99] text-[11px] font-medium select-none bg-[#1e1e38] rounded-md px-1 py-0.5">
              <button 
                onClick={() => setVIdx(v => Math.max(0, v - 1))} 
                disabled={vIdx === 0} 
                className="p-1 hover:text-[#c8c8e8] disabled:opacity-30 disabled:hover:text-[#6b6b99] transition-colors"
              >
                <ChevronLeft size={13}/>
              </button>
              <span>{vIdx + 1} / {safeVariants.length}</span>
              <button 
                onClick={() => setVIdx(v => Math.min(safeVariants.length - 1, v + 1))} 
                disabled={vIdx === safeVariants.length - 1} 
                className="p-1 hover:text-[#c8c8e8] disabled:opacity-30 disabled:hover:text-[#6b6b99] transition-colors"
              >
                <ChevronRight size={13}/>
              </button>
            </div>
          )}

          <ActionBtn onClick={handleCopy} title="Copy Response">
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
          </ActionBtn>
          
          {onRegenerate && (
            <ActionBtn onClick={onRegenerate} title="Regenerate Response">
              <RotateCcw size={13} />
            </ActionBtn>
          )}
          
          <div className="w-px h-3.5 bg-[#2a2a50] mx-0.5" />
          <ActionBtn title="Good response"><ThumbsUp size={13} /></ActionBtn>
          <ActionBtn title="Bad response"><ThumbsDown size={13} /></ActionBtn>
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ children, onClick, title }: { children: React.ReactNode; onClick?: () => void; title: string; }) {
  return (
    <button
      onClick={onClick}
      className="p-1.5 rounded-md text-[#6b6b99] hover:text-[#c8c8e8] hover:bg-[#1e1e38] transition-all duration-150 cursor-pointer border-none bg-transparent flex items-center justify-center"
      title={title}
    >
      {children}
    </button>
  );
}