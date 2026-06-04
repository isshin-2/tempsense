import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type, exiting: false }]);
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 300);
  }, []);

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur || 6000),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
    info: (msg, dur) => addToast(msg, 'info', dur),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const iconMap = {
  success: <CheckCircle2 size={18} />,
  error: <XCircle size={18} />,
  warning: <AlertTriangle size={18} />,
  info: <Info size={18} />,
};

const colorMap = {
  success: { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', text: '#34d399' },
  error: { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#f87171' },
  warning: { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', text: '#fbbf24' },
  info: { bg: 'rgba(59, 130, 246, 0.15)', border: '#3b82f6', text: '#60a5fa' },
};

function ToastItem({ toast, onClose }) {
  const colors = colorMap[toast.type] || colorMap.info;

  return (
    <div style={{
      background: colors.bg,
      backdropFilter: 'blur(16px)',
      border: `1px solid ${colors.border}40`,
      borderRadius: '12px',
      padding: '14px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      color: colors.text,
      fontSize: '14px',
      fontWeight: 500,
      minWidth: '300px',
      maxWidth: '420px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      pointerEvents: 'all',
      animation: toast.exiting ? 'toastOut 0.3s ease forwards' : 'toastIn 0.3s ease',
      fontFamily: "'Inter', sans-serif",
    }}>
      {iconMap[toast.type]}
      <span style={{ flex: 1, color: '#e2e8f0' }}>{toast.message}</span>
      <button onClick={onClose} style={{
        background: 'none', border: 'none', color: colors.text, cursor: 'pointer',
        padding: '4px', borderRadius: '4px', display: 'flex',
        opacity: 0.6, transition: 'opacity 0.2s',
      }}
        onMouseOver={e => e.currentTarget.style.opacity = '1'}
        onMouseOut={e => e.currentTarget.style.opacity = '0.6'}
      >
        <X size={14} />
      </button>
      <style>{`
        @keyframes toastIn {
          from { transform: translateX(100px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes toastOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
