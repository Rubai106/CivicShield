import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { notificationsAPI } from '../services/api';
import { useSocket } from '../context/SocketContext';
import { formatDistanceToNow } from 'date-fns';

const BellIcon = ({ hasUnread }) => (
  <div className="relative">
    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
    {hasUnread && (
      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-950" />
    )}
  </div>
);

const typeColors = {
  status_change: 'bg-blue-500/20 text-blue-400',
  new_comment: 'bg-green-500/20 text-green-400',
  reopen_decision: 'bg-orange-500/20 text-orange-400',
  assignment: 'bg-purple-500/20 text-purple-400',
  sla_breach: 'bg-red-500/20 text-red-400',
  general: 'bg-slate-500/20 text-slate-400',
};

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  const { on } = useSocket() || {};

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    if (!on) return;
    const cleanup = on('notification', (notif) => {
      setNotifications(prev => [notif, ...prev]);
      setUnreadCount(c => c + 1);
    });
    return cleanup;
  }, [on]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const { data } = await notificationsAPI.getAll({ limit: 20 });
      setNotifications(data.data.notifications);
      setUnreadCount(data.data.unread_count);
    } catch {}
    setLoading(false);
  };

  const markRead = async (id) => {
    try {
      await notificationsAPI.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(c => Math.max(0, c - 1));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {}
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(!open); if (!open) loadNotifications(); }}
        className="p-2 rounded-lg hover:bg-slate-800 transition-colors relative"
      >
        <BellIcon hasUnread={unreadCount > 0} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1 border-2 border-slate-950">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 card shadow-xl shadow-black/50 animate-in z-50 max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-100">Notifications</h3>
              {unreadCount > 0 && (
                <p className="text-xs text-slate-400">{unreadCount} unread</p>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-civic-400 hover:text-civic-300 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications list */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-8 flex items-center justify-center">
                <div className="w-6 h-6 spinner" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <svg className="w-10 h-10 text-slate-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
                <p className="text-slate-500 text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3 border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${
                    !notif.is_read ? 'bg-civic-600/5' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${typeColors[notif.type] || typeColors.general}`}>
                      {notif.type.replace('_', ' ')}
                    </div>
                    {!notif.is_read && (
                      <div className="w-2 h-2 bg-civic-500 rounded-full mt-2 ml-auto shrink-0" />
                    )}
                  </div>
                  <p className="text-sm font-medium text-slate-200 mt-1.5">{notif.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{notif.message}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[11px] text-slate-500">
                      {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                    </span>
                    <div className="flex items-center gap-2">
                      {notif.report_id && (
                        <Link
                          to={`/reports/${notif.report_id}`}
                          className="text-[11px] text-civic-400 hover:text-civic-300"
                          onClick={() => { markRead(notif.id); setOpen(false); }}
                        >
                          View Report →
                        </Link>
                      )}
                      {!notif.is_read && (
                        <button
                          onClick={() => markRead(notif.id)}
                          className="text-[11px] text-slate-500 hover:text-slate-300"
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
