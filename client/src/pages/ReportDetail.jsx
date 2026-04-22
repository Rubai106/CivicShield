import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { reportsAPI, commentsAPI, reopenAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { formatDistanceToNow, format } from 'date-fns';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  'Draft': 'bg-slate-600/20 text-slate-400',
  'Submitted': 'bg-blue-600/20 text-blue-400',
  'Under Review': 'bg-yellow-600/20 text-yellow-400',
  'Investigating': 'bg-orange-600/20 text-orange-400',
  'Resolved': 'bg-green-600/20 text-green-400',
  'Closed': 'bg-slate-600/20 text-slate-300',
};

const PRIORITY_COLORS = {
  'Low': 'bg-green-900/40 text-green-400',
  'Medium': 'bg-yellow-900/40 text-yellow-400',
  'High': 'bg-orange-900/40 text-orange-400',
  'Critical': 'bg-red-900/40 text-red-400',
};

const AUTHORITY_STATUSES = ['Under Review', 'Investigating', 'Resolved', 'Closed'];

export default function ReportDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [report, setReport] = useState(null);
  const [comments, setComments] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenRequests, setReopenRequests] = useState([]);
  const commentsEndRef = useRef(null);

  useEffect(() => {
    fetchReport();
    if (socket) {
      socket.emit('join_report', id);
      socket.on('new_comment', (comment) => setComments(p => [...p, comment]));
      socket.on('report_updated', (updated) => setReport(p => ({ ...p, ...updated })));
      return () => {
        socket.emit('leave_report', id);
        socket.off('new_comment');
        socket.off('report_updated');
      };
    }
  }, [id]);

  useEffect(() => { commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [comments]);

  const fetchReport = async () => {
    try {
      const [repRes, comRes] = await Promise.all([
        reportsAPI.getById(id),
        commentsAPI.getForReport(id),
      ]);
      const reportData = repRes.data.data.report;
      setReport(reportData);
      setComments(comRes.data.data.comments || []);
      setTimeline(repRes.data.data.timeline || []);
      if (user?.role === 'authority') {
        const rrRes = await reopenAPI.getForReport(id);
        setReopenRequests(rrRes.data.data.requests || []);
      }
    } catch (err) {
      toast.error('Failed to load report');
      navigate(-1);
    } finally { setLoading(false); }
  };

  const handleStatusUpdate = async (newStatus) => {
    setUpdatingStatus(true);
    try {
      await reportsAPI.updateStatus(id, { status: newStatus });
      setReport(p => ({ ...p, status: newStatus }));
      toast.success(`Status updated to ${newStatus}`);
    } catch { toast.error('Failed to update status'); }
    finally { setUpdatingStatus(false); }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      const { data } = await commentsAPI.create(id, { content: commentText });
      setComments(p => [...p, data.data.comment]);
      setCommentText('');
    } catch { toast.error('Failed to post comment'); }
    finally { setSubmittingComment(false); }
  };

  const handleReopenRequest = async () => {
    if (!reopenReason.trim()) { toast.error('Please provide a reason'); return; }
    try {
      await reopenAPI.request(id, { reason: reopenReason });
      toast.success('Reopen request submitted');
      setShowReopenModal(false);
      setReopenReason('');
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed to submit request'); }
  };

  const handleReopenDecision = async (reqId, decision) => {
    try {
      await reopenAPI.decide(id, reqId, { decision, note: '' });
      toast.success(`Request ${decision}`);
      fetchReport();
    } catch { toast.error('Failed to process decision'); }
  };

  if (loading) return (
    <div className="min-h-screen"><Navbar />
      <div className="flex items-center justify-center h-80">
        <div className="text-slate-400">Loading report...</div>
      </div>
    </div>
  );

  if (!report) return null;

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-screen-xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[report.status] || 'bg-slate-700 text-slate-300'}`}>
                {report.status}
              </span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${PRIORITY_COLORS[report.priority] || 'bg-slate-700 text-slate-300'}`}>
                {report.priority} Priority
              </span>
              <code className="text-xs bg-slate-800 text-blue-400 px-2 py-1 rounded font-mono">{report.tracking_id}</code>
            </div>
            <h1 className="text-xl font-bold text-white">{report.title}</h1>
            <p className="text-sm text-slate-400 mt-1">
              {report.category_name && <span className="mr-3">📂 {report.category_name}</span>}
              {report.department_name && <span className="mr-3">🏛 {report.department_name}</span>}
              Reported {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
            </p>
          </div>
          <button onClick={() => navigate(-1)} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors">
            ← Back
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="card p-5">
              <h3 className="font-semibold text-slate-200 mb-3">Description</h3>
              <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{report.description}</p>
              {report.location_text && (
                <div className="mt-4 p-3 bg-slate-800 rounded-lg">
                  <p className="text-xs text-slate-400 mb-1">📍 Location</p>
                  <p className="text-sm text-slate-300">{report.location_text}</p>
                </div>
              )}
              {report.incident_date && (
                <div className="mt-3 text-sm text-slate-400">
                  🕐 Incident date: {format(new Date(report.incident_date), 'PPP p')}
                </div>
              )}
            </div>

            {/* Evidence */}
            {report.evidence?.length > 0 && (
              <div className="card p-5">
                <h3 className="font-semibold text-slate-200 mb-3">Evidence ({report.evidence.length})</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {report.evidence.map(ev => (
                    <a key={ev.id} href={ev.file_url} target="_blank" rel="noreferrer"
                      className="group block p-3 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
                      {ev.file_type?.startsWith('image') ? (
                        <img src={ev.file_url} alt={ev.file_name} className="w-full h-24 object-cover rounded mb-2" />
                      ) : (
                        <div className="w-full h-24 bg-slate-700 rounded flex items-center justify-center text-2xl mb-2">
                          {ev.file_type?.includes('pdf') ? '📄' : ev.file_type?.startsWith('video') ? '🎥' : '📎'}
                        </div>
                      )}
                      <p className="text-xs text-slate-400 truncate">{ev.file_name}</p>
                      {ev.hash_sha256 && (
                        <p className="text-xs text-green-500 mt-1">✓ Verified</p>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Comments */}
            <div className="card p-5">
              <h3 className="font-semibold text-slate-200 mb-4">Discussion Thread</h3>
              <div className="space-y-3 max-h-80 overflow-y-auto mb-4">
                {comments.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">No comments yet. Start the conversation.</p>
                ) : (
                  comments.map(c => (
                    <div key={c.id} className={`flex gap-3 ${c.author_id === user?.id ? 'flex-row-reverse' : ''}`}>
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-semibold shrink-0">
                        {c.author_name?.[0]?.toUpperCase()}
                      </div>
                      <div className={`max-w-sm ${c.author_id === user?.id ? 'items-end' : 'items-start'} flex flex-col`}>
                        <div className={`px-3 py-2 rounded-lg text-sm ${c.author_id === user?.id ? 'bg-blue-600/30 text-blue-100' : 'bg-slate-800 text-slate-200'}`}>
                          <p className="font-medium text-xs mb-1 opacity-70">{c.author_name} • {c.author_role}</p>
                          {c.content}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={commentsEndRef} />
              </div>
              <form onSubmit={handleComment} className="flex gap-2">
                <input value={commentText} onChange={e => setCommentText(e.target.value)}
                  placeholder="Type a message..." maxLength={1000}
                  className="flex-1 px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:border-blue-500" />
                <button type="submit" disabled={submittingComment || !commentText.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm rounded-lg transition-colors">
                  Send
                </button>
              </form>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Authority Actions */}
            {user?.role === 'authority' && (
              <div className="card p-4">
                <h3 className="font-semibold text-slate-200 mb-3">Update Status</h3>
                <div className="space-y-2">
                  {AUTHORITY_STATUSES.map(s => (
                    <button key={s} onClick={() => handleStatusUpdate(s)}
                      disabled={updatingStatus || report.status === s}
                      className={`w-full py-2 text-sm rounded-lg transition-colors font-medium
                        ${report.status === s
                          ? 'bg-blue-600/20 text-blue-400 border border-blue-600/40'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}>
                      {report.status === s ? '✓ ' : ''}{s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Reopen Requests for Authority */}
            {user?.role === 'authority' && reopenRequests.filter(r => r.status === 'Pending').length > 0 && (
              <div className="card p-4">
                <h3 className="font-semibold text-slate-200 mb-3">Reopen Requests</h3>
                {reopenRequests.filter(r => r.status === 'Pending').map(req => (
                  <div key={req.id} className="p-3 bg-slate-800 rounded-lg mb-2">
                    <p className="text-sm text-slate-300 mb-2">{req.reason}</p>
                    <div className="flex gap-2">
                      <button onClick={() => handleReopenDecision(req.id, 'Approved')}
                        className="flex-1 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs rounded font-medium">Approve</button>
                      <button onClick={() => handleReopenDecision(req.id, 'Denied')}
                        className="flex-1 py-1.5 bg-red-700 hover:bg-red-600 text-white text-xs rounded font-medium">Deny</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Reporter Actions */}
            {user?.role === 'reporter' && report.status === 'Closed' && (
              <div className="card p-4">
                <h3 className="font-semibold text-slate-200 mb-2">Case Closed</h3>
                <p className="text-sm text-slate-400 mb-3">If you believe this case needs further investigation, you can request a reopen.</p>
                <button onClick={() => setShowReopenModal(true)}
                  className="w-full py-2 bg-orange-700 hover:bg-orange-600 text-white text-sm rounded-lg transition-colors font-medium">
                  Request Reopen
                </button>
              </div>
            )}

            {/* Timeline */}
            <div className="card p-4">
              <h3 className="font-semibold text-slate-200 mb-3">Activity Timeline</h3>
              <div className="space-y-3">
                {timeline.length === 0 ? (
                  <p className="text-xs text-slate-500">No activity yet</p>
                ) : (
                  timeline.map(t => (
                    <div key={t.id} className="flex gap-2.5 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                      <div>
                        <p className="text-slate-300">{t.action}</p>
                        {t.details && <p className="text-xs text-slate-500">{t.details}</p>}
                        <p className="text-xs text-slate-500">{formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Report Info */}
            <div className="card p-4">
              <h3 className="font-semibold text-slate-200 mb-3">Report Info</h3>
              <div className="space-y-2 text-sm">
                {[
                  ['Reporter', report.is_anonymous ? 'Anonymous' : report.reporter_name],
                  ['Department', report.department_name || 'Unassigned'],
                  ['SLA Deadline', report.sla_deadline ? format(new Date(report.sla_deadline), 'PPP') : 'N/A'],
                  ['Created', format(new Date(report.created_at), 'PPP')],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-slate-400">{label}</span>
                    <span className="text-slate-200 font-medium text-right max-w-[180px] truncate">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reopen Modal */}
      {showReopenModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="card p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-3">Request Reopen</h3>
            <p className="text-sm text-slate-400 mb-4">Explain why this case should be reopened for further investigation.</p>
            <textarea value={reopenReason} onChange={e => setReopenReason(e.target.value)} rows={4}
              placeholder="Provide a detailed reason for reopening..."
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm mb-4 focus:border-blue-500 resize-none" />
            <div className="flex gap-3">
              <button onClick={() => setShowReopenModal(false)}
                className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg">Cancel</button>
              <button onClick={handleReopenRequest}
                className="flex-1 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg">Submit Request</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
