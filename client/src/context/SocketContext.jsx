import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user) {
      setSocket(prev => { prev?.disconnect(); return null; });
      return;
    }

    const token = localStorage.getItem('cs_token');
    const s = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });

    s.on('connect_error', (err) => {
      console.warn('[socket] connect error:', err.message);
    });

    setSocket(s);
    return () => { s.disconnect(); };
  }, [user?.id]);

  // Stable event-listener helper: registers listener and returns a cleanup function.
  // NotificationCenter and other consumers call: const cleanup = on('event', cb);
  const on = useCallback((event, cb) => {
    if (!socket) return () => {};
    socket.on(event, cb);
    return () => socket.off(event, cb);
  }, [socket]);

  return (
    <SocketContext.Provider value={{ socket, on }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
