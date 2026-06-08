import { Thermometer } from 'lucide-react';

export default function LoadingScreen({ message = 'Initializing...' }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'var(--bg-primary)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div style={{ animation: 'pulse 2s ease-in-out infinite', marginBottom: '24px' }}>
        <Thermometer size={48} style={{ color: '#3b82f6' }} />
      </div>
      <h1 style={{
        fontSize: '28px',
        fontWeight: 800,
        background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        marginBottom: '8px',
      }}>TEMPSENSE</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase' }}>
        {message}
      </p>
      <div style={{
        marginTop: '32px',
        width: '200px',
        height: '3px',
        background: 'var(--border-subtle)',
        borderRadius: '4px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: '60%',
          height: '100%',
          background: 'linear-gradient(90deg, #3b82f6, #06b6d4)',
          borderRadius: '4px',
          animation: 'loadingBar 1.5s ease-in-out infinite',
        }} />
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.7; }
        }
        @keyframes loadingBar {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(80%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}
