import React, { useState, useEffect } from 'react';

const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

export default function UpdatePrompt() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(null);

  useEffect(() => {
    async function checkVersion() {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`);
        if (!res.ok) return;
        const data = await res.json();
        
        if (currentVersion === null) {
          // First load, save current version
          setCurrentVersion(data.version);
        } else if (data.version !== currentVersion) {
          // Version changed!
          setUpdateAvailable(true);
        }
      } catch (err) {
        // Ignore fetch errors (e.g. offline)
      }
    }

    // Check immediately, then every 5 minutes
    checkVersion();
    const interval = setInterval(checkVersion, CHECK_INTERVAL);
    
    // Also check when window regains focus
    const onFocus = () => checkVersion();
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [currentVersion]);

  if (!updateAvailable) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      backgroundColor: '#1e40af', // blue-800
      color: 'white',
      padding: '16px 24px',
      borderRadius: '12px',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div>
        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Update Available</h4>
        <p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: 0.9 }}>A new version of TEMPSENSE is ready.</p>
      </div>
      <button 
        onClick={() => window.location.reload(true)}
        style={{
          backgroundColor: 'white',
          color: '#1e40af',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '6px',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'background-color 0.2s'
        }}
        onMouseOver={e => e.currentTarget.style.backgroundColor = '#f3f4f6'}
        onMouseOut={e => e.currentTarget.style.backgroundColor = 'white'}
      >
        Refresh
      </button>
    </div>
  );
}
