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

    // Authority accounts return pendingApproval — no token, no login
    if (data.data?.pendingApproval) {
      return { pendingApproval: true };
    }

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

  return (
    <AuthContext.Provider value={{
      user, loading,
      login, register, logout, updateUser, loadUser,
      isAdmin: user?.role === 'admin',
      isAuthority: user?.role === 'authority',
      isReporter: user?.role === 'reporter',
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
