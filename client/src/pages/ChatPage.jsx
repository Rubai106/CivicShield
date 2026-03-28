import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { chatAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

export default function ChatPage() {
  const { userId: targetUserId } = useParams();
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    fetchContacts();
    if (targetUserId) loadConversation(targetUserId);
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('new_message', (msg) => {
      if (selectedUser && (msg.sender_id === selectedUser.id || msg.receiver_id === selectedUser.id)) {
        setMessages(p => [...p, msg]);
      } else {
        toast(`New message from ${msg.sender_name}`, { icon: '💬' });
        fetchContacts();
      }
    });
    socket.on('user_typing', ({ from }) => {
      if (from === selectedUser?.id) setIsTyping(true);
    });
    socket.on('user_stop_typing', ({ from }) => {
      if (from === selectedUser?.id) setIsTyping(false);
    });
    return () => {
      socket.off('private_message');
      socket.off('user_typing');
      socket.off('user_stop_typing');
    };
  }, [socket, selectedUser]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const fetchContacts = async () => {
    try {
      const { data } = await chatAPI.getContacts();
      setContacts(data.data?.conversations?.map(c => ({...c, id: c.partner_id, name: c.partner_name, role: c.partner_role, last_message: c.last_message, unread: parseInt(c.unread_count)||0})) || []);
    } catch {}
  };

  const loadConversation = async (uid) => {
    setLoading(true);
    try {
      const [convRes, userRes] = await Promise.all([
        chatAPI.getConversation(uid),
        chatAPI.getUser(uid),
      ]);
      setMessages(convRes.data.data?.messages || []);
      setSelectedUser(userRes.data.data?.user);
    } catch { toast.error('Failed to load conversation'); }
    finally { setLoading(false); }
  };

  const handleSelectUser = (contact) => {
    setSelectedUser(contact);
    loadConversation(contact.id);
    navigate(`/chat/${contact.id}`, { replace: true });
  };

  const handleSend = async () => {
    if (!messageText.trim() || !selectedUser) return;
    const text = messageText;
    setMessageText('');
    try {
      const { data } = await chatAPI.sendMessage(selectedUser.id, { content: text });
      setMessages(p => [...p, data.data.message]);
      socket?.emit('stop_typing', { to: selectedUser.id });
    } catch { toast.error('Failed to send message'); setMessageText(text); }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); return; }
    if (socket && selectedUser) {
      socket.emit('typing', { to: selectedUser.id });
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => socket.emit('stop_typing', { to: selectedUser.id }), 1500);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-6">
        <div className="card overflow-hidden" style={{ height: 'calc(100vh - 160px)', minHeight: 500 }}>
          <div className="flex h-full">
            {/* Contacts List */}
            <div className="w-72 border-r border-slate-700 flex flex-col">
              <div className="p-4 border-b border-slate-700">
                <h2 className="font-semibold text-slate-200">Messages</h2>
              </div>
              <div className="flex-1 overflow-y-auto">
                {contacts.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-400">No conversations yet</div>
                ) : contacts.map(c => (
                  <button key={c.id} onClick={() => handleSelectUser(c)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800 transition-colors text-left
                      ${selectedUser?.id === c.id ? 'bg-slate-800' : ''}`}>
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                      {c.name?.[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-200 truncate">{c.name}</p>
                        {c.unread > 0 && (
                          <span className="ml-2 bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5 shrink-0">{c.unread}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">{c.role} • {c.last_message || 'No messages yet'}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col">
              {!selectedUser ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-4xl mb-3">💬</div>
                    <p className="text-slate-400">Select a contact to start chatting</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Chat Header */}
                  <div className="px-5 py-3.5 border-b border-slate-700 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold">
                      {selectedUser.name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-200 text-sm">{selectedUser.name}</p>
                      <p className="text-xs text-slate-400 capitalize">{selectedUser.role}</p>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loading ? <div className="text-center text-slate-400 py-8">Loading...</div> :
                      messages.length === 0 ? (
                        <div className="text-center text-slate-400 py-8 text-sm">No messages yet. Say hello!</div>
                      ) : messages.map((msg, i) => {
                        const isOwn = msg.sender_id === user?.id;
                        return (
                          <div key={msg.id || i} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-xs lg:max-w-sm px-4 py-2.5 rounded-2xl text-sm
                              ${isOwn ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-slate-700 text-slate-200 rounded-bl-sm'}`}>
                              <p>{msg.content}</p>
                              <p className={`text-xs mt-1 ${isOwn ? 'text-blue-200' : 'text-slate-400'}`}>
                                {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    }
                    {isTyping && (
                      <div className="flex justify-start">
                        <div className="px-4 py-2.5 bg-slate-700 rounded-2xl rounded-bl-sm">
                          <div className="flex gap-1">
                            {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <div className="p-4 border-t border-slate-700">
                    <div className="flex gap-2">
                      <textarea value={messageText} onChange={e => setMessageText(e.target.value)} onKeyDown={handleKeyDown}
                        rows={1} placeholder="Type a message... (Enter to send)"
                        className="flex-1 px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-blue-500 resize-none" />
                      <button onClick={handleSend} disabled={!messageText.trim()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl transition-colors">
                        →
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
