import { Settings, User, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

interface TopBarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export default function TopBar({ sidebarOpen, onToggleSidebar }: TopBarProps) {
  return (
    <header
      className="flex items-center justify-between px-4 py-3 flex-shrink-0"
      style={{
        background: 'rgba(13, 13, 20, 0.75)',
        backdropFilter: 'blur(20px) saturate(150%)',
        WebkitBackdropFilter: 'blur(20px) saturate(150%)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        boxShadow: '0 1px 0 rgba(124,106,247,0.06)',
      }}
    >
      {/* Left: sidebar toggle + model name */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-lg text-[#6b6b99] hover:text-[#a0a0c8] hover:bg-[#1e1e38] transition-all duration-150"
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>
        <div className="flex items-center gap-2">
          <div
            className="w-1.5 h-1.5 rounded-full bg-emerald-400"
            style={{ boxShadow: '0 0 6px rgba(52,211,153,0.6)', animation: 'nova-pulse 3s ease-in-out infinite' }}
          />
          <span className="text-xs text-[#6b6b99] font-medium">Nova Local · llama3</span>
        </div>
      </div>

      {/* Right: profile + settings */}
      <div className="flex items-center gap-1">
        <button
          className="flex items-center gap-2 text-sm text-[#6b6b99] hover:text-[#a0a0c8] px-3 py-1.5 rounded-lg hover:bg-[#1e1e38] transition-all duration-150"
          title="Profile"
        >
          <User size={16} />
          <span className="text-xs font-medium">Profile</span>
        </button>
        <button
          className="p-1.5 rounded-lg text-[#6b6b99] hover:text-[#a0a0c8] hover:bg-[#1e1e38] transition-all duration-150"
          title="Settings"
        >
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
}