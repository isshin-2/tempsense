import { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

export default function ConnectionStatus() {
  const [status, setStatus] = useState('checking'); // 'online' | 'offline' | 'checking'
  const [show, setShow] = useState(false);
  const [lastCheck, setLastCheck] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function checkHealth() {
      try {
        const url = (import.meta.env.VITE_API_URL || '') + '/api/health';
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (res.ok && mounted) {
          if (status === 'offline') {
            // Was offline, now recovered
            setShow(true);
            setTimeout(() => setShow(false), 3000);
          }
          setStatus('online');
          setLastCheck(new Date());
        } else if (mounted) {
          setStatus('offline');
          setShow(true);
        }
      } catch {
        if (mounted) {
          setStatus('offline');
          setShow(true);
        }
      }
    }

    checkHealth();
    const interval = setInterval(checkHealth, 30000);

    // Also check on online/offline events
    const goOnline = () => checkHealth();
    const goOffline = () => { if (mounted) { setStatus('offline'); setShow(true); } };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [status]);

  // Only show if offline or just recovered
  if (status === 'online' && !show) return null;
  if (status === 'checking') return null;

  const isOffline = status === 'offline';

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9998,
      animation: 'slideUpToast 0.3s ease',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 20px',
        borderRadius: '12px',
        fontSize: '13px',
        fontWeight: 600,
        fontFamily: "'Inter', sans-serif",
        backdropFilter: 'blur(16px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        background: isOffline ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
        border: `1px solid ${isOffline ? '#ef444440' : '#10b98140'}`,
        color: isOffline ? '#f87171' : '#34d399',
      }}>
        {isOffline ? <WifiOff size={16} /> : <Wifi size={16} />}
        <span style={{ color: '#e2e8f0' }}>
          {isOffline
            ? 'Connection to server lost. Retrying...'
            : 'Connection restored!'
          }
        </span>
        {isOffline && (
          <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
        )}
      </div>
      <style>{`
        @keyframes slideUpToast {
          from { transform: translateX(-50%) translateY(20px); opacity: 0; }
          to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
