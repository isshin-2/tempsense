import { createContext, useContext, useState, useEffect } from 'react';
import { getUser, getToken, login as apiLogin, logout as apiLogout } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    const saved = getUser();
    if (token && saved) {
      setUser(saved);
    }
    setLoading(false);
  }, []);

  async function login(email, password) {
    const data = await apiLogin(email, password);
    setUser(data.user);
    return data;
  }

  function logout() {
    apiLogout();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
