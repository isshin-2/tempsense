import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { validateInvite, acceptInvite } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Thermometer, Eye, EyeOff, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function AcceptInvitePage() {
  const { updateUser } = useAuth();
  const navigate = useNavigate();
  
  const [token, setToken] = useState('');
  const [validating, setValidating] = useState(true);
  const [user, setUser] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token');
    if (!t) {
      setError('No invitation token provided. Please use the link sent to your email.');
      setValidating(false);
      return;
    }
    setToken(t);
    
    validateInvite(t)
      .then((data) => {
        setUser(data);
        setValidating(false);
      })
      .catch((err) => {
        setError(err.message || 'The invitation link is invalid or has expired.');
        setValidating(false);
      });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await acceptInvite(token, password);
      setSuccess(true);
      
      // Save credentials and log in
      localStorage.setItem('tempsense_token', res.token);
      localStorage.setItem('tempsense_user', JSON.stringify(res.user));
      updateUser(res.user);
      
      // Wait a moment so they see success state
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to complete registration. Please try again.');
      setSubmitting(false);
    }
  }

  if (validating) {
    return (
      <div className="login-page">
        <div className="login-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
          <Loader2 size={32} className="animate-spin" style={{ color: '#3b82f6', marginBottom: '16px' }} />
          <p style={{ margin: 0 }}>Validating invitation link...</p>
        </div>
      </div>
    );
  }

  if (error && !success) {
    return (
      <div className="login-page">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <AlertCircle size={48} style={{ color: '#ef4444' }} />
          </div>
          <h1>Invitation Error</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.5 }}>{error}</p>
          <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }} onClick={() => navigate('/login')}>
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="login-page">
        <div className="login-card" style={{ textAlign: 'center', padding: '48px' }}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <CheckCircle size={48} className="text-success" style={{ color: '#10b981' }} />
          </div>
          <h1>Setup Complete!</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '0' }}>Your account is ready. Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <Thermometer size={40} style={{ color: '#3b82f6' }} />
        </div>
        <h1>TEMPSENSE</h1>
        <p style={{ marginBottom: '24px' }}>Welcome, {user?.name || 'User'}! Setup Your Password</p>

        {error && (
          <div className="error-msg" role="alert" style={{ marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email Address</label>
            <input className="form-input" type="email" value={user?.email || ''} disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} />
          </div>
          
          <div className="form-group">
            <label>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password (min 6 chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingRight: '44px' }}
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px',
                  display: 'flex', alignItems: 'center'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label>Confirm Password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{ paddingRight: '44px' }}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px',
                  display: 'flex', alignItems: 'center'
                }}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: '100%', justifyContent: 'center' }}>
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" style={{ marginRight: '6px' }} />
                Setting password...
              </>
            ) : 'Complete Account Setup'}
          </button>
        </form>
      </div>
    </div>
  );
}
