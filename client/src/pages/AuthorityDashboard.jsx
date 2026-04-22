import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { reportsAPI, authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  'Submitted': 'bg-blue-600/20 text-blue-400',
  'Under Review': 'bg-yellow-600/20 text-yellow-400',
  'Investigating': 'bg-orange-600/20 text-orange-400',
  'Resolved': 'bg-green-600/20 text-green-400',
  'Closed': 'bg-slate-600/20 text-slate-400',
};

const PRIORITY_COLORS = {
  'Low': 'text-green-400', 'Medium': 'text-yellow-400',
  'High': 'text-orange-400', 'Critical': 'text-red-400',
};

export default function AuthorityDashboard() {
  const { user, authorityProfile } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', priority: '', page: 1, search: '' });
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ total: 0, pending: 0, critical: 0, resolved: 0 });

  useEffect(() => { fetchReports(); }, [filters]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { data } = await reportsAPI.getAll({ ...filters, limit: 10 });
      const reps = data.data.reports || [];
      setReports(reps);
      setTotalPages(data.data.totalPages || 1);
      setStats({
        total: data.data.total || reps.length,
        pending: reps.filter(r => r.status === 'Submitted').length,
        critical: reps.filter(r => r.priority === 'Critical').length,
        resolved: reps.filter(r => ['Resolved','Closed'].includes(r.status)).length,
      });
    } catch { toast.error('Failed to load reports'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Authority Dashboard</h1>
            <p className="text-slate-400 text-sm mt-1">
              {authorityProfile?.department_name
                ? `${authorityProfile.department_name} — ${authorityProfile.designation || 'Officer'}`
                : 'Manage assigned incident reports'}
            </p>
          </div>
          {!authorityProfile?.department_id && (
            <Link to="/profile" className="px-4 py-2 bg-orange-700 hover:bg-orange-600 text-white text-sm rounded-lg transition-colors">
              Complete Onboarding →
            </Link>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Assigned', value: stats.total, icon: '📋', color: 'text-blue-400' },
            { label: 'New / Pending', value: stats.pending, icon: '🔔', color: 'text-yellow-400' },
            { label: 'Critical', value: stats.critical, icon: '🚨', color: 'text-red-400' },
            { label: 'Resolved', value: stats.resolved, icon: '✅', color: 'text-green-400' },
          ].map(s => (
            <div key={s.label} className="card p-4">
              <div className="text-xl mb-1">{s.icon}</div>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
          <input value={filters.search} onChange={e => setFilters(p => ({ ...p, search: e.target.value, page: 1 }))}
            placeholder="Search reports..." className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:border-blue-500 w-48" />
          <select value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value, page: 1 }))}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm">
            <option value="">All Statuses</option>
            {['Submitted','Under Review','Investigating','Resolved','Closed'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filters.priority} onChange={e => setFilters(p => ({ ...p, priority: e.target.value, page: 1 }))}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm">
            <option value="">All Priorities</option>
            {['Critical','High','Medium','Low'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* Reports Table */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-400">Loading reports...</div>
          ) : reports.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-slate-400">No reports found for your department.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700 text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Report</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Category</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Priority</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Reporter</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Submitted</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {reports.map(r => (
                  <tr key={r.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-slate-200 truncate max-w-[220px]">{r.title}</p>
                      <code className="text-xs text-blue-400 font-mono">{r.tracking_id}</code>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <span className="text-xs text-slate-300 bg-slate-700 px-2 py-0.5 rounded">{r.category_name || '—'}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[r.status] || 'bg-slate-700 text-slate-300'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 hidden sm:table-cell">
                      <span className={`text-xs font-semibold ${PRIORITY_COLORS[r.priority] || 'text-slate-400'}`}>
                        {r.priority}
                      </span>
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <span className="text-xs text-slate-400">{r.is_anonymous ? '🎭 Anonymous' : r.reporter_name}</span>
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell text-xs text-slate-400">
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-4">
                      <Link to={`/reports/${r.id}`}
                        className="text-xs px-3 py-1.5 bg-blue-700/30 hover:bg-blue-700/50 text-blue-400 rounded-lg transition-colors font-medium">
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            <button disabled={filters.page <= 1} onClick={() => setFilters(p => ({ ...p, page: p.page - 1 }))}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-sm rounded-lg">← Prev</button>
            <span className="px-3 py-1.5 text-slate-400 text-sm">Page {filters.page} of {totalPages}</span>
            <button disabled={filters.page >= totalPages} onClick={() => setFilters(p => ({ ...p, page: p.page + 1 }))}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-sm rounded-lg">Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}
