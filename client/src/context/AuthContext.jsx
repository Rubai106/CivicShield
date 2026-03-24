import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('cs_token');
    if (!token) { setLoading(false); return; }

    try {
      const { data } = await authAPI.getMe();
      setUser(data.data.user);
    } catch {
      localStorage.removeItem('cs_token');
      localStorage.removeItem('cs_user');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const login = async (email, password) => {
    const { data } = await authAPI.login({ email, password });
    const { user, token } = data.data;
    localStorage.setItem('cs_token', token);
    localStorage.setItem('cs_user', JSON.stringify(user));
    setUser(user);
    return { user };
  };

  const register = async (formData) => {
    const { data } = await authAPI.register(formData);
    const { user, token } = data.data;
    localStorage.setItem('cs_token', token);
    localStorage.setItem('cs_user', JSON.stringify(user));
    setUser(user);
    return user;
  };

  const logout = () => {
    localStorage.removeItem('cs_token');
    localStorage.removeItem('cs_user');
    setUser(null);
    toast.success('Logged out successfully.');
  };

  const updateUser = (updatedUser) => {
    setUser(prev => ({ ...prev, ...updatedUser }));
    localStorage.setItem('cs_user', JSON.stringify({ ...user, ...updatedUser }));
  };

  const isAdmin = user?.role === 'admin';
  const isAuthority = user?.role === 'authority';
  const isReporter = user?.role === 'reporter';

  return (
    <AuthContext.Provider value={{
      user, loading,
      login, register, logout, updateUser, loadUser,
      isAdmin, isAuthority, isReporter,
      token: localStorage.getItem('cs_token'),
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

// AuthContext already exported above - this is a patch for refreshUser usage
