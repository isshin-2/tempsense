import { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin, logout as apiLogout, getUser, getToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initAuth() {
      const token = getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const url = (import.meta.env.VITE_API_URL || '') + '/api/auth/me';
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          localStorage.setItem('tempsense_user', JSON.stringify(data.user));
        } else {
          // Token is invalid/expired
          localStorage.removeItem('tempsense_token');
          localStorage.removeItem('tempsense_user');
          setUser(null);
        }
      } catch (err) {
        // Network error, fallback to saved user
        const saved = getUser();
        if (saved) setUser(saved);
      }
      setLoading(false);
    }
    initAuth();
  }, []);

  async function login(email, password) {
    const { token, user } = await apiLogin(email, password);
    setUser(user);
    return user;
  }

  function logout() {
    apiLogout();
    setUser(null);
  }

  function updateUser(updatedUser) {
    setUser(updatedUser);
    localStorage.setItem('tempsense_user', JSON.stringify(updatedUser));
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
