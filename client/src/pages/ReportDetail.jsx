import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { reportsAPI, commentsAPI, departmentsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { formatDistanceToNow, format } from 'date-fns';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  'Draft':         'bg-slate-600/20 text-slate-400',
  'Submitted':     'bg-blue-600/20 text-blue-400',
  'Under Review':  'bg-yellow-600/20 text-yellow-400',
  'Investigating': 'bg-orange-600/20 text-orange-400',
  'Resolved':      'bg-green-600/20 text-green-400',
  'Closed':        'bg-slate-600/20 text-slate-300',
};

const PRIORITY_COLORS = {
  'low':      'bg-green-900/40 text-green-400',
  'medium':   'bg-yellow-900/40 text-yellow-400',
  'high':     'bg-orange-900/40 text-orange-400',
  'critical': 'bg-red-900/40 text-red-400',
};

// Status transitions authority can make — must match PATCH /:id/status validTransitions
const AUTHORITY_STATUSES = ['Under Review', 'Investigating', 'Resolved', 'Closed'];

export default function ReportDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [report, setReport]               = useState(null);
  const [evidence, setEvidence]           = useState([]);
  const [comments, setComments]           = useState([]);
  const [timeline, setTimeline]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [commentText, setCommentText]     = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [updatingStatus, setUpdatingStatus]       = useState(false);
  const [showReassign, setShowReassign]   = useState(false);
  const [departments, setDepartments]     = useState([]);
  const [reassignDeptId, setReassignDeptId] = useState('');
  const [reassignNote, setReassignNote]   = useState('');
  const [reassigning, setReassigning]     = useState(false);
  const commentsEndRef = useRef(null);

  useEffect(() => {
    fetchReport();

    if (user?.role === 'authority' || user?.role === 'admin') {
      departmentsAPI.getAll()
        .then(({ data }) => setDepartments(data.data?.departments || data.data || []))
        .catch(() => {});
    }

    if (socket) {
      socket.emit('join_report', id);
      socket.on('new_comment', (comment) => setComments(prev => [...prev, comment]));
      socket.on('report_updated', (updated) => setReport(prev => ({ ...prev, ...updated })));
      return () => {
        socket.emit('leave_report', id);
        socket.off('new_comment');
        socket.off('report_updated');
      };
    }
  }, [id]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const fetchReport = async () => {
    try {
      const [repRes, comRes] = await Promise.all([
        reportsAPI.getById(id),
        commentsAPI.getForReport(id),
      ]);
      setReport(repRes.data.data.report);
      setEvidence(repRes.data.data.evidence || []);
      // Local server returns "history", remote returns "timeline" — handle both
      setTimeline(repRes.data.data.timeline || repRes.data.data.history || []);
      setComments(comRes.data.data.comments || []);
    } catch {
      toast.error('Failed to load report');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    if (updatingStatus) return;
    setUpdatingStatus(true);
    try {
      await reportsAPI.updateStatus(id, { status: newStatus });
      setReport(prev => ({ ...prev, status: newStatus }));
      toast.success(`Status updated to "${newStatus}"`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      const { data } = await commentsAPI.create(id, { content: commentText });
      setComments(prev => [...prev, data.data.comment]);
      setCommentText('');
    } catch {
      toast.error('Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleReassign = async () => {
    if (!reassignDeptId) { toast.error('Select a department'); return; }
    setReassigning(true);
    try {
      const { data } = await reportsAPI.reassign(id, { department_id: reassignDeptId, note: reassignNote });
      setReport(prev => ({ ...prev, ...data.data.report }));
      toast.success(data.message || 'Case reassigned');
      setShowReassign(false);
      setReassignDeptId('');
      setReassignNote('');
      // Refresh timeline
      const repRes = await reportsAPI.getById(id);
      setTimeline(repRes.data.data.timeline || repRes.data.data.history || []);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to reassign');
    } finally {
      setReassigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center h-80">
          <div className="text-slate-400">Loading report...</div>
        </div>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-screen-xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[report.status] || 'bg-slate-700 text-slate-300'}`}>
                {report.status}
              </span>
              {report.priority && (
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${PRIORITY_COLORS[report.priority?.toLowerCase()] || 'bg-slate-700 text-slate-300'}`}>
                  {report.priority} Priority
                </span>
              )}
              <code className="text-xs bg-slate-800 text-blue-400 px-2 py-1 rounded font-mono">{report.tracking_id}</code>
            </div>
            <h1 className="text-xl font-bold text-white">{report.title}</h1>
            <p className="text-sm text-slate-400 mt-1">
              {report.category_name && <span className="mr-3">📂 {report.category_name}</span>}
              {report.department_name && <span className="mr-3">🏛 {report.department_name}</span>}
              Reported {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
            </p>
          </div>
          <button onClick={() => navigate(-1)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors shrink-0">
            ← Back
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Main content */}
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
            {evidence.length > 0 && (
              <div className="card p-5">
                <h3 className="font-semibold text-slate-200 mb-3">Evidence ({evidence.length})</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {evidence.map(ev => (
                    <a key={ev.id} href={ev.file_url} target="_blank" rel="noreferrer"
                      className="group block p-3 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
                      {ev.file_type?.startsWith('image') ? (
                        <img src={ev.file_url} alt={ev.file_name}
                          className="w-full h-24 object-cover rounded mb-2" />
                      ) : (
                        <div className="w-full h-24 bg-slate-700 rounded flex items-center justify-center text-2xl mb-2">
                          {ev.file_type?.includes('pdf') ? '📄' : ev.file_type?.startsWith('video') ? '🎥' : '📎'}
                        </div>
                      )}
                      <p className="text-xs text-slate-400 truncate">{ev.file_name}</p>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Comment thread */}
            <div className="card p-5">
              <h3 className="font-semibold text-slate-200 mb-4">Discussion Thread</h3>

              <div className="space-y-3 max-h-80 overflow-y-auto mb-4 pr-1">
                {comments.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">
                    No comments yet. Start the conversation.
                  </p>
                ) : (
                  comments.map(c => (
                    <div key={c.id} className={`flex gap-3 ${c.author_id === user?.id ? 'flex-row-reverse' : ''}`}>
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-semibold shrink-0">
                        {c.author_name?.[0]?.toUpperCase()}
                      </div>
                      <div className={`max-w-sm flex flex-col ${c.author_id === user?.id ? 'items-end' : 'items-start'}`}>
                        <div className={`px-3 py-2 rounded-lg text-sm ${c.author_id === user?.id
                          ? 'bg-blue-600/30 text-blue-100'
                          : 'bg-slate-800 text-slate-200'}`}>
                          <p className="font-medium text-xs mb-1 opacity-70">
                            {c.author_name} · {c.author_role}
                          </p>
                          {c.content}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={commentsEndRef} />
              </div>

              <form onSubmit={handleComment} className="flex gap-2">
                <input
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Type a message..."
                  maxLength={1000}
                  className="flex-1 px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={submittingComment || !commentText.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm rounded-lg transition-colors"
                >
                  Send
                </button>
              </form>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">

            {/* Authority status update */}
            {user?.role === 'authority' && (
              <div className="card p-4">
                <h3 className="font-semibold text-slate-200 mb-3">Update Status</h3>
                <div className="space-y-2">
                  {AUTHORITY_STATUSES.map(s => (
                    <button
                      key={s}
                      onClick={() => handleStatusUpdate(s)}
                      disabled={updatingStatus || report.status === s}
                      className={`w-full py-2 text-sm rounded-lg transition-colors font-medium
                        ${report.status === s
                          ? 'bg-blue-600/20 text-blue-400 border border-blue-600/40'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
                    >
                      {report.status === s ? '✓ ' : ''}{s}
                    </button>
                  ))}
                </div>
                {updatingStatus && (
                  <p className="text-xs text-slate-500 mt-2 text-center">Updating...</p>
                )}
              </div>
            )}

            {/* Reassign Case */}
            {(user?.role === 'authority' || user?.role === 'admin') && (
              <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-200">Reassign Case</h3>
                  <button onClick={() => setShowReassign(v => !v)}
                    className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors">
                    {showReassign ? 'Cancel' : 'Reassign'}
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Current: <span className="text-slate-300">{report.department_name || 'Unassigned'}</span>
                </p>
                {showReassign && (
                  <div className="mt-3 space-y-2">
                    <select value={reassignDeptId} onChange={e => setReassignDeptId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:border-blue-500 focus:outline-none">
                      <option value="">Select new department</option>
                      {departments
                        .filter(d => d.id !== report.assigned_department_id)
                        .map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <input value={reassignNote} onChange={e => setReassignNote(e.target.value)}
                      placeholder="Reason for reassignment (optional)"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:border-blue-500 focus:outline-none" />
                    <button onClick={handleReassign} disabled={reassigning || !reassignDeptId}
                      className="w-full py-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white text-sm rounded-lg transition-colors font-medium">
                      {reassigning ? 'Reassigning...' : 'Confirm Reassignment'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Activity Timeline */}
            <div className="card p-4">
              <h3 className="font-semibold text-slate-200 mb-3">Activity Timeline</h3>
              <div className="space-y-3">
                {timeline.length === 0 ? (
                  <p className="text-xs text-slate-500">No activity recorded yet.</p>
                ) : (
                  timeline.map((t, i) => (
                    <div key={t.id || i} className="flex gap-2.5 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                      <div>
                        <p className="text-slate-300">
                          {t.to_status
                            ? `Status: ${t.from_status || '—'} → ${t.to_status}`
                            : t.action || 'Activity'}
                        </p>
                        {t.note && <p className="text-xs text-slate-500">{t.note}</p>}
                        <p className="text-xs text-slate-500">
                          {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Report info */}
            <div className="card p-4">
              <h3 className="font-semibold text-slate-200 mb-3">Report Info</h3>
              <div className="space-y-2 text-sm">
                {[
                  ['Reporter', report.is_anonymous ? 'Anonymous' : (report.reporter_name || 'Unknown')],
                  ['Department', report.department_name || 'Unassigned'],
                  ['Created', format(new Date(report.created_at), 'PPP')],
                  ...(report.submitted_at ? [['Submitted', format(new Date(report.submitted_at), 'PPP')]] : []),
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between gap-2">
                    <span className="text-slate-400 shrink-0">{label}</span>
                    <span className="text-slate-200 font-medium text-right truncate">{val}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
