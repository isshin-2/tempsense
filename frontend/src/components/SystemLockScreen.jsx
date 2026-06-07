import { useState } from 'react';
import { ShieldAlert, KeyRound, Unlock, Loader2, Lock } from 'lucide-react';
import { unlockServer } from '../services/api';

export default function SystemLockScreen({ onUnlocked }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!key.trim()) return;

    setLoading(true);
    setError('');
    try {
      await unlockServer(key.trim());
      onUnlocked();
    } catch (err) {
      setError(err.message || 'Invalid decryption key. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="lock-screen-container">
      <div className="lock-screen-card">
        <div className="lock-icon-container">
          <div className="lock-pulse-ring"></div>
          {loading ? (
            <Loader2 className="lock-icon animate-spin" size={40} style={{ color: '#3b82f6' }} />
          ) : error ? (
            <ShieldAlert className="lock-icon shake-animation" size={40} style={{ color: '#ef4444' }} />
          ) : (
            <Lock className="lock-icon" size={40} style={{ color: '#f59e0b' }} />
          )}
        </div>

        <h2>System Locked</h2>
        <p>This TEMPSENSE server requires the SMTP decryption key to initialize default credentials and start services.</p>

        {error && <div className="lock-error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="decryption-key">
              <KeyRound size={14} style={{ marginRight: '6px' }} /> Decryption Passphrase
            </label>
            <input
              id="decryption-key"
              type="password"
              className="form-input"
              placeholder="Enter passphrase (e.g. Xgtfgz-Mcrrc)"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              disabled={loading}
              required
              autoFocus
            />
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: '8px', justifyContent: 'center' }}>
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" style={{ marginRight: '8px' }} />
                Unlocking System...
              </>
            ) : (
              <>
                <Unlock size={16} style={{ marginRight: '8px' }} />
                Verify & Unlock
              </>
            )}
          </button>
        </form>

        <div className="lock-footer">
          Maxworth Techserv • Secure Cold Chain Gateway
        </div>
      </div>

      <style>{`
        .lock-screen-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: radial-gradient(circle at center, #111a2e 0%, #060a13 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 99999;
          padding: 20px;
        }

        .lock-screen-card {
          background: rgba(26, 34, 54, 0.65);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 40px 32px;
          width: 100%;
          max-width: 440px;
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5);
          text-align: center;
        }

        .lock-icon-container {
          position: relative;
          width: 80px;
          height: 80px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px;
        }

        .lock-pulse-ring {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 1px solid rgba(245, 158, 11, 0.2);
          animation: pulse 2s infinite ease-in-out;
        }

        .lock-screen-card h2 {
          color: #f1f5f9;
          font-size: 24px;
          font-weight: 800;
          margin: 0 0 12px;
          letter-spacing: -0.5px;
        }

        .lock-screen-card p {
          color: #94a3b8;
          font-size: 14px;
          line-height: 1.6;
          margin: 0 0 24px;
        }

        .lock-error-msg {
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.25);
          color: #fca5a5;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
          margin-bottom: 20px;
          text-align: left;
          animation: shake 0.4s ease-in-out;
        }

        .lock-footer {
          margin-top: 32px;
          font-size: 11px;
          color: #4b5563;
          letter-spacing: 0.5px;
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }

        @keyframes pulse {
          0% {
            transform: scale(0.95);
            opacity: 0.5;
          }
          50% {
            transform: scale(1.15);
            opacity: 0.8;
          }
          100% {
            transform: scale(0.95);
            opacity: 0.5;
          }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }

        .shake-animation {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
}
