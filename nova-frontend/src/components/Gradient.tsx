interface GradientProps {
  isWelcome: boolean;
}

export default function Gradient({ isWelcome }: GradientProps) {
  return (
    <div 
      className="fixed inset-0 pointer-events-none select-none overflow-hidden z-0"
      style={{ minHeight: '100vh', minWidth: '100vw' }}
    >
      {/* ── Top-Left Ambient Glow Spot ── */}
      <div
        className="absolute transition-opacity duration-1000 ease-in-out"
        style={{
          width: '600px',
          height: '600px',
          top: '-200px',
          left: '-200px',
          background: 'radial-gradient(circle, rgba(59,130,246,0.10) 0%, rgba(59,130,246,0.02) 50%, transparent 70%)',
          animation: 'nova-pulse 7s ease-in-out infinite',
          opacity: isWelcome ? 1 : 0,
        }}
      />

      {/* ── Bottom-Right Ambient Glow Spot ── */}
      <div
        className="absolute transition-opacity duration-1000 ease-in-out"
        style={{
          width: '700px',
          height: '700px',
          bottom: '-250px',
          right: '-250px',
          background: 'radial-gradient(circle, rgba(37,99,235,0.08) 0%, rgba(37,99,235,0.01) 50%, transparent 70%)',
          animation: 'nova-pulse 9s ease-in-out infinite',
          animationDelay: '1.5s',
          opacity: isWelcome ? 1 : 0,
        }}
      />
    </div>
  );
}