import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
// import { formatDistanceToNow } from 'date-fns';
import Navbar from '../components/Navbar';
import { reportsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function ReporterDashboard() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'submitted', 'drafts'
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    console.log('ReporterDashboard: Component mounted');

    const loadReports = async () => {
      try {
        console.log('ReporterDashboard: Starting API call');
        const response = await reportsAPI.getAll({ limit: 20 });
        console.log('ReporterDashboard: Full API response', response);
        console.log('ReporterDashboard: Response data', response.data);
        setReports(response.data.data?.reports || []);
        setError(null);
      } catch (err) {
        console.error('ReporterDashboard: API error', err);
        console.error('ReporterDashboard: Error response', err.response);
        setError('Failed to load reports');
        toast.error('Failed to load reports');
      } finally {
        console.log('ReporterDashboard: Loading finished');
        setLoading(false);
      }
    };

    loadReports();
  }, []);

  const filteredReports = reports.filter(report => {
    if (filter === 'drafts') return report.is_draft;
    if (filter === 'submitted') return !report.is_draft;
    return true; // 'all'
  });

  const handleEditDraft = (reportId) => {
    console.log('ReporterDashboard: Editing draft', reportId);
    navigate(`/reports/${reportId}/edit`);
  };

  console.log('ReporterDashboard: Rendering', { loading, reportsLength: reports.length, error });

  // Fallback: ensure loading is cleared after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        console.log('ReporterDashboard: Force clearing loading state');
        setLoading(false);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [loading]);

  if (error) {
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        Error: {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />

      <div className="max-w-screen-lg mx-auto px-4 py-8 page-enter">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">My Reports</h1>
            <p className="text-sm text-slate-500 mt-1">Manage your reports here.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/chat" className="text-sm px-3 py-2 rounded border border-white/[0.08] text-slate-300 hover:bg-white/[0.05] transition-colors flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Messages
            </Link>
            {user?.role !== 'authority' && <Link to="/reports/new" className="btn-primary text-sm">File New Report</Link>}
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-sm rounded border transition-colors ${filter === 'all'
                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
                : 'bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-slate-300'
              }`}
          >
            All ({reports.length})
          </button>
          <button
            onClick={() => setFilter('submitted')}
            className={`px-3 py-1.5 text-sm rounded border transition-colors ${filter === 'submitted'
                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
                : 'bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-slate-300'
              }`}
          >
            Submitted ({reports.filter(r => !r.is_draft).length})
          </button>
          <button
            onClick={() => setFilter('drafts')}
            className={`px-3 py-1.5 text-sm rounded border transition-colors ${filter === 'drafts'
                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
                : 'bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-slate-300'
              }`}
          >
            Drafts ({reports.filter(r => r.is_draft).length})
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="w-8 h-8 spinner" /></div>
        ) : filteredReports.length === 0 ? (
          <div className="card p-8 text-center" style={{ color: '#e2e8f0', fontSize: '18px', fontWeight: 'bold' }}>
            <div style={{ marginBottom: '20px' }}>📋</div>
            {filter === 'drafts' ? 'No drafts yet.' : filter === 'submitted' ? 'No submitted reports yet.' : 'No reports yet.'}
            <div style={{ marginTop: '10px', fontSize: '14px', color: '#94a3b8' }}>
              Click "File New Report" to create your first report.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReports.map((report) => (
              <div key={report.id} className="card p-4 card-hover">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-slate-100 font-medium truncate">{report.title || 'Untitled Draft'}</p>
                      {report.is_draft && (
                        <span className="px-2 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs">Draft</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mb-2">{report.tracking_id}</p>

                    <div className="flex items-center gap-2 mt-2 text-xs text-slate-400 flex-wrap">
                      {report.category_name && <span className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08]">{report.category_name}</span>}
                      {report.is_anonymous && <span className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">Anonymous</span>}
                      {report.evidence_count > 0 && <span>{report.evidence_count} evidence file(s)</span>}
                      {report.location_text && <span className="truncate max-w-[240px]">{report.location_text}</span>}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="text-xs text-slate-500">
                      {new Date(report.created_at).toLocaleDateString()}
                    </span>
                    {report.is_draft && (
                      <button
                        onClick={() => handleEditDraft(report.id)}
                        className="text-xs px-2 py-1 rounded border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                      >
                        Edit Draft
                      </button>
                    )}
                    {!report.is_draft && (
                      <div className="flex items-center gap-2">
                        <Link
                          to="/chat"
                          title="Message authority"
                          className="text-xs px-2 py-1 rounded border border-white/[0.08] text-slate-400 hover:bg-white/[0.05] transition-colors"
                        >
                          💬
                        </Link>
                        <Link
                          to={`/reports/${report.id}`}
                          className="text-xs px-2 py-1 rounded border border-white/[0.08] text-slate-400 hover:bg-white/[0.05] transition-colors"
                        >
                          View Details
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
