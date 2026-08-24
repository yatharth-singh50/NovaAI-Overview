import { Activity, Globe, Eye, Play, MoreHorizontal } from 'lucide-react';
import novaLogo from '../assets/NovaAITransparent.png';

interface Suggestion {
  icon: React.ReactNode;
  label: string;
  prompt: string;
}

const suggestions: Suggestion[] = [
  { icon: <Activity size={14} />, label: 'System telemetry', prompt: 'What is my current system telemetry, PC performance, and battery status?' },
  { icon: <Eye size={14} />, label: 'Analyze image', prompt: 'I have attached an image. Can you scan it and explain what is going on?' },
  { icon: <Globe size={14} />, label: 'Search the web', prompt: 'Search the web for the latest major news in artificial intelligence.' },
  { icon: <Play size={14} />, label: 'Play Spotify', prompt: 'Open Spotify and play some focus music.' },
];

interface WelcomeScreenProps {
  onSuggestionClick: (prompt: string) => void;
}

const PARTICLES: { angle: number; r: number; size: number }[] = [
  { angle: 20,  r: 66, size: 2.5 },
  { angle: 75,  r: 60, size: 2   },
  { angle: 140, r: 68, size: 3   },
  { angle: 195, r: 62, size: 2   },
  { angle: 255, r: 65, size: 2.5 },
  { angle: 320, r: 60, size: 2   },
  { angle: 50,  r: 72, size: 1.5 },
  { angle: 170, r: 70, size: 1.5 },
  { angle: 290, r: 71, size: 1.5 },
];

export default function WelcomeScreen({ onSuggestionClick }: WelcomeScreenProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 relative z-10">

      {/* ── Nova Logo + Orbiting Particles ── */}
      <div
        className="relative mb-8 nova-fade-in flex items-center justify-center"
        style={{ width: 140, height: 140, animationDelay: '0s' }}
      >
        {/* Soft ambient glow behind the logo */}
        <div
          className="absolute rounded-full"
          style={{
            width: 130,
            height: 130,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle, rgba(59,130,246,0.18) 0%, rgba(37,99,235,0.07) 55%, transparent 75%)',
            animation: 'nova-logo-glow 4s ease-in-out infinite',
          }}
        />

        {/* The actual Nova SVG logo */}
        <img
          src={novaLogo}
          alt="Nova AI"
          style={{
            width: 86,
            height: 86,
            position: 'relative',
            zIndex: 1,
            animation: 'nova-logo-pulse 4s ease-in-out infinite',
            filter: 'drop-shadow(0 0 10px rgba(59,130,246,0.55)) drop-shadow(0 0 24px rgba(37,99,235,0.3))',
          }}
        />

        {/* Orbiting sparkle particles */}
        {PARTICLES.map((p, i) => {
          const rad = (p.angle * Math.PI) / 180;
          const cx = 70; // center of 140px container
          const cy = 70;
          const x = cx + p.r * Math.cos(rad) - p.size / 2;
          const y = cy + p.r * Math.sin(rad) - p.size / 2;
          return (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: p.size,
                height: p.size,
                left: x,
                top: y,
                background: 'rgba(147,197,253,0.85)',
                boxShadow: '0 0 5px 1px rgba(59,130,246,0.7)',
                animation: 'nova-particle-twinkle 3s ease-in-out infinite',
                animationDelay: `${i * 0.33}s`,
              }}
            />
          );
        })}
      </div>

      {/* Welcome text */}
      <div className="text-center mb-10 nova-fade-in" style={{ animationDelay: '0.1s' }}>
        <h2
          className="text-4xl font-light text-white mb-3 tracking-tight"
          style={{ letterSpacing: '-0.02em' }}
        >
          What can{' '}
          <span
            className="font-semibold"
            style={{
              background: 'linear-gradient(135deg, #93c5fd 0%, #3b82f6 50%, #2563eb 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Nova
          </span>{' '}
          help you with?
        </h2>
        <p className="text-[#4a6080] text-base font-light">
          Ask anything — I think locally, so your data stays yours.
        </p>
      </div>

      {/* Suggestion chips */}
      <div
        className="flex flex-wrap items-center justify-center gap-2 max-w-lg nova-fade-in"
        style={{ animationDelay: '0.25s' }}
      >
        {suggestions.map((s) => (
          <button
            key={s.label}
            onClick={() => onSuggestionClick(s.prompt)}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-[#93b8d8] border border-[#1e2a4a] bg-[#0a1020]/80 hover:bg-[#0f1929] hover:text-white hover:border-[#3b82f6]/50 transition-all duration-200 backdrop-blur-sm"
            style={{ backdropFilter: 'blur(8px)' }}
          >
            <span className="text-[#3b82f6]">{s.icon}</span>
            {s.label}
          </button>
        ))}
        <button className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-[#4a6080] border border-[#1e2a4a] bg-[#0a1020]/80 hover:bg-[#0f1929] hover:text-white transition-all duration-200">
          <MoreHorizontal size={14} />
          More
        </button>
      </div>
    </div>
  );
}