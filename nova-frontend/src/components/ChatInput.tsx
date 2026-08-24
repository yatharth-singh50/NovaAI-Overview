import { useRef, useEffect, useState } from 'react';
import type { KeyboardEvent, ClipboardEvent } from 'react';
import { ArrowUp, Paperclip, X, Zap, Brain, ChevronDown, Check } from 'lucide-react';

interface ChatInputProps {
  value: string;
  onChange: (val: string) => void;
  onSend: (imageB64?: string, pdfInfo?: { b64: string; name: string }, isSuperNova?: boolean) => void;
  isStreaming?: boolean;
}

const MODELS = [
  {
    id: 'Nova' as const,
    label: 'Nova',
    description: 'Fast & efficient',
    icon: Zap,
    iconColor: '#60a5fa',
    labelColor: '#93c5fd',
  },
  {
    id: 'SuperNova' as const,
    label: 'SuperNova',
    description: 'Deep reasoning',
    icon: Brain,
    iconColor: '#a78bfa',
    labelColor: '#c4b5fd',
  },
];

export default function ChatInput({ value, onChange, onSend, isStreaming = false }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [attachedPdf, setAttachedPdf] = useState<{ b64: string; name: string } | null>(null);
  const [isDraggingGlobally, setIsDraggingGlobally] = useState(false);
  const [modelTier, setModelTier] = useState<'Nova' | 'SuperNova'>('Nova');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const activeModel = MODELS.find((m) => m.id === modelTier)!;

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Global drag and drop
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => { e.preventDefault(); setIsDraggingGlobally(true); };
    const handleDragLeave = (e: DragEvent) => {
      if (e.clientX === 0 || e.clientY === 0) setIsDraggingGlobally(false);
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDraggingGlobally(false);
      if (e.dataTransfer?.files?.[0]) processFile(e.dataTransfer.files[0]);
    };
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [value]);

  const processFile = async (file: File) => {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => { if (e.target?.result) setAttachedImage(e.target.result as string); };
      reader.readAsDataURL(file);
    } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) setAttachedPdf({ b64: e.target.result as string, name: file.name });
      };
      reader.readAsDataURL(file);
    } else {
      const text = await file.text();
      onChange(value + (value ? '\n\n' : '') + `--- ${file.name} ---\n${text}\n-------------------\n`);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) { e.preventDefault(); processFile(file); break; }
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files?.[0]) processFile(files[0]);
  };

  const handleLocalSend = () => {
    if ((value.trim() || attachedImage || attachedPdf) && !isStreaming) {
      // Pass attachedPdf instead of attachedPdf?.b64
      onSend(attachedImage || undefined, attachedPdf || undefined, modelTier === 'SuperNova');
      setAttachedImage(null);
      setAttachedPdf(null);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleLocalSend(); }
  };

  const canSend = (value.trim().length > 0 || attachedImage !== null || attachedPdf !== null) && !isStreaming;

  return (
    <>
      {/* Global drop overlay */}
      {isDraggingGlobally && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a1020]/80 backdrop-blur-sm border-2 border-dashed border-[#3b82f6]">
          <div className="flex flex-col items-center pointer-events-none">
            <div className="w-20 h-20 bg-[#3b82f6]/20 rounded-full flex items-center justify-center mb-4">
              <Paperclip size={32} className="text-[#3b82f6]" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-wide">Drop Files Anywhere</h2>
            <p className="text-[#a0a0c8] mt-2">Images, Code files, and PDFs are supported</p>
          </div>
        </div>
      )}

      <div className="px-4 pb-6 pt-2 max-w-3xl w-full mx-auto relative z-40">
        <div className="relative flex flex-col rounded-2xl border bg-[#0a1020]/90 backdrop-blur-md p-3 transition-all duration-200 border-[#1e2a4a] focus-within:border-[#3b82f6]/60">

          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

          {/* Attachment previews */}
          <div className="flex gap-3 px-1">
            {attachedImage && (
              <div className="relative inline-block mb-3 w-20 h-20">
                <img src={attachedImage} alt="Preview" className="w-20 h-20 object-cover rounded-xl border border-[#1e2a4a]" />
                <button onClick={() => setAttachedImage(null)} className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow">
                  <X size={10} strokeWidth={3} />
                </button>
              </div>
            )}
            {attachedPdf && (
              <div className="relative inline-flex items-center gap-2 mb-3 px-3 py-2 bg-[#1e2a4a]/50 rounded-xl border border-[#1e2a4a]">
                <div className="bg-red-500/20 p-2 rounded-lg"><span className="text-red-400 font-bold text-xs uppercase">PDF</span></div>
                <span className="text-xs text-[#c8d8e8] max-w-[120px] truncate">{attachedPdf.name}</span>
                <button onClick={() => setAttachedPdf(null)} className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow">
                  <X size={10} strokeWidth={3} />
                </button>
              </div>
            )}
          </div>

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Message Nova, paste images, or drop code files..."
            rows={1}
            className="w-full bg-transparent text-sm text-[#c8d8e8] placeholder-[#3a5070] focus:outline-none resize-none pr-12 pl-1 max-h-[200px] leading-relaxed"
          />

          <div className="flex items-center justify-between border-t border-[#0f1929]/60 mt-2 pt-2">

            {/* ── Model dropdown ── */}
            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setDropdownOpen((o) => !o)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-all duration-150 group"
                style={{
                  background: dropdownOpen ? 'rgba(30,42,74,0.6)' : 'transparent',
                  border: dropdownOpen ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
                }}
                onMouseEnter={(e) => {
                  if (!dropdownOpen) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(15,25,41,0.8)';
                    (e.currentTarget as HTMLButtonElement).style.border = '1px solid rgba(30,42,74,0.8)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!dropdownOpen) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    (e.currentTarget as HTMLButtonElement).style.border = '1px solid transparent';
                  }
                }}
              >
                <activeModel.icon size={12} strokeWidth={2.5} style={{ color: activeModel.iconColor }} />
                <span className="text-[12px] font-semibold" style={{ color: activeModel.labelColor }}>
                  {activeModel.label}
                </span>
                <ChevronDown
                  size={11}
                  className="transition-transform duration-200"
                  style={{
                    color: '#3a5070',
                    transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                />
              </button>

              {/* Dropdown menu — opens upward */}
              {dropdownOpen && (
                <div
                  className="absolute left-0 bottom-full mb-2 w-52 rounded-2xl overflow-hidden z-50"
                  style={{
                    background: '#0d1625',
                    border: '1px solid #1e2a4a',
                    boxShadow: '0 -8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(59,130,246,0.08)',
                    animation: 'nova-fade-in 0.15s ease-out both',
                  }}
                >
                  {/* Header label */}
                  <div className="px-3.5 pt-3 pb-2">
                    <p className="text-[10px] font-bold tracking-widest uppercase text-[#2a4060]">
                      Select Model
                    </p>
                  </div>

                  {MODELS.map((model, i) => {
                    const Icon = model.icon;
                    const isActive = model.id === modelTier;
                    return (
                      <button
                        key={model.id}
                        onClick={() => { setModelTier(model.id); setDropdownOpen(false); }}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 transition-all duration-150 text-left"
                        style={{
                          background: isActive ? 'rgba(59,130,246,0.08)' : 'transparent',
                          borderBottom: i < MODELS.length - 1 ? '1px solid rgba(30,42,74,0.5)' : 'none',
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(15,25,41,0.8)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                        }}
                      >
                        {/* Icon badge */}
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{
                            background: isActive
                              ? `rgba(${model.id === 'Nova' ? '59,130,246' : '167,139,250'},0.15)`
                              : 'rgba(30,42,74,0.4)',
                            border: isActive
                              ? `1px solid rgba(${model.id === 'Nova' ? '59,130,246' : '167,139,250'},0.3)`
                              : '1px solid rgba(30,42,74,0.6)',
                          }}
                        >
                          <Icon size={14} strokeWidth={2} style={{ color: isActive ? model.iconColor : '#3a5070' }} />
                        </div>

                        {/* Label + description */}
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-[13px] font-semibold leading-tight"
                            style={{ color: isActive ? model.labelColor : '#6b8599' }}
                          >
                            {model.label}
                          </p>
                          <p className="text-[11px] mt-0.5" style={{ color: '#2a4060' }}>
                            {model.description}
                          </p>
                        </div>

                        {/* Active checkmark */}
                        {isActive && (
                          <Check size={13} strokeWidth={2.5} style={{ color: model.iconColor, flexShrink: 0 }} />
                        )}
                      </button>
                    );
                  })}

                  {/* Bottom padding */}
                  <div className="h-1.5" />
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-[#4a6080] hover:text-[#93c5fd] hover:bg-[#0f1929] transition-all"
              >
                <Paperclip size={15} />
              </button>

              <button
                onClick={handleLocalSend}
                disabled={!canSend}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={canSend
                  ? { background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', boxShadow: '0 0 12px rgba(59,130,246,0.4)' }
                  : { background: '#1e2a4a' }}
              >
                {isStreaming
                  ? <div className="w-3 h-3 rounded-sm bg-white animate-pulse" />
                  : <ArrowUp size={15} className="text-white" strokeWidth={2.5} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}