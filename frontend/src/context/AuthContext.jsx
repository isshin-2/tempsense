import { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin, logout as apiLogout, getUser, getToken } from '../services/api';

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
