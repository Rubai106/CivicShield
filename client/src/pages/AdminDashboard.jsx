import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { adminAPI, categoriesAPI, departmentsAPI, reportsAPI } from '../services/api';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import toast from 'react-hot-toast';

// ── Overview ──────────────────────────────────────────────────────────────────
function Overview() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.getAnalytics()
      .then(({ data }) => {
        const d = data.data;
        setAnalytics({
          totalReports: d?.summary?.total || 0,
          activeCases: d?.summary?.open || 0,
          resolved: d?.summary?.resolved || 0,
          totalUsers: d?.summary?.total_users || 0,
          totalAuthorities: d?.summary?.total_authorities || 0,
          pendingRequests: d?.summary?.pending_authority_requests || 0,
          monthlyTrend: (d?.monthly_trend || []).map(m => ({ month: m.month, count: parseInt(m.count) })),
          byCategory: (d?.category_distribution || []).map(c => ({ name: c.name, count: parseInt(c.count) })),
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-400 p-8 text-center">Loading analytics...</div>;

  const kpis = [
    { label: 'Total Reports', value: analytics?.totalReports || 0, icon: '📋', color: 'text-blue-400', link: '/admin/reports' },
    { label: 'Active Cases', value: analytics?.activeCases || 0, icon: '🔍', color: 'text-orange-400' },
    { label: 'Resolved', value: analytics?.resolved || 0, icon: '✅', color: 'text-green-400' },
    { label: 'Total Users', value: analytics?.totalUsers || 0, icon: '👥', color: 'text-purple-400' },
    { label: 'Authorities', value: analytics?.totalAuthorities || 0, icon: '🏛', color: 'text-yellow-400' },
    { label: 'Pending Approvals', value: analytics?.pendingRequests || 0, icon: '⏳', color: 'text-red-400', link: '/admin/authority-review' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">System Overview</h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map(k => {
          const card = (
            <div key={k.label} className={`bg-slate-900 border border-slate-800 rounded-lg p-5 ${k.link ? 'cursor-pointer hover:border-slate-600 transition-colors' : ''}`}>
              <div className="text-2xl mb-2">{k.icon}</div>
              <div className={`text-3xl font-bold ${k.color}`}>{k.value}</div>
              <div className="text-sm text-slate-400 mt-1">{k.label}</div>
              {k.link && <div className="text-xs text-slate-500 mt-1">Click to view →</div>}
            </div>
          );
          return k.link ? <Link key={k.label} to={k.link}>{card}</Link> : card;
        })}
      </div>

      {analytics?.monthlyTrend?.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
          <h3 className="text-base font-semibold text-slate-200 mb-4">Monthly Report Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={analytics.monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 12 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ background: '#1a2035', border: '1px solid #334155', borderRadius: 8 }} />
              <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="#3b82f620" strokeWidth={2} name="Reports" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {analytics?.byCategory?.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
          <h3 className="text-base font-semibold text-slate-200 mb-4">Reports by Category</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={analytics.byCategory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ background: '#1a2035', border: '1px solid #334155', borderRadius: 8 }} />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Reports" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ── Authority Review Panel ────────────────────────────────────────────────────
function AuthorityReviewPanel() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selected, setSelected] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [infoModal, setInfoModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchRequests = useCallback(() => {
    setLoading(true);
    adminAPI.getAuthorityRequests({ status: statusFilter })
      .then(({ data }) => setRequests(data.data?.requests || []))
      .catch(() => toast.error('Failed to load requests'))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleApprove = async (id) => {
    if (!window.confirm('Approve this authority account? They will get full access immediately.')) return;
    setSubmitting(true);
    try {
      await adminAPI.approveAuthority(id);
      toast.success('✅ Authority approved and account activated!');
      fetchRequests();
      setSelected(null);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to approve');
    } finally { setSubmitting(false); }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { toast.error('Please provide a rejection reason'); return; }
    setSubmitting(true);
    try {
      await adminAPI.rejectAuthority(rejectModal, { reason: rejectReason });
      toast.success('Request rejected');
      setRejectModal(null);
      setRejectReason('');
      fetchRequests();
      setSelected(null);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to reject');
    } finally { setSubmitting(false); }
  };

  const handleRequestInfo = async () => {
    if (!infoMessage.trim()) { toast.error('Please enter a message'); return; }
    setSubmitting(true);
    try {
      await adminAPI.requestMoreInfo(infoModal, { message: infoMessage });
      toast.success('📬 Info request sent to authority');
      setInfoModal(null);
      setInfoMessage('');
      fetchRequests();
      setSelected(null);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to send');
    } finally { setSubmitting(false); }
  };

  const statusBadge = (s) => {
    const map = {
      pending: 'bg-yellow-900/40 text-yellow-400',
      approved: 'bg-green-900/40 text-green-400',
      rejected: 'bg-red-900/40 text-red-400',
      info_requested: 'bg-blue-900/40 text-blue-400',
    };
    return map[s] || 'bg-slate-700 text-slate-400';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Authority Review Panel</h2>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm"
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="info_requested">Info Requested</option>
          <option value="all">All</option>
        </select>
      </div>

      {loading ? (
        <div className="text-slate-400 p-8 text-center">Loading requests...</div>
      ) : requests.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 text-center">
          <p className="text-slate-400 text-lg">No {statusFilter} requests</p>
          <p className="text-slate-500 text-sm mt-1">Authority requests will appear here when submitted</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {requests.map(req => (
            <div
              key={req.id}
              onClick={() => setSelected(selected?.id === req.id ? null : req)}
              className="bg-slate-900 border border-slate-800 rounded-lg p-5 cursor-pointer hover:border-slate-600 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-slate-200">{req.user_name}</p>
                  <p className="text-sm text-slate-400">{req.user_email}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(req.status)}`}>
                    {req.status.replace('_', ' ')}
                  </span>
                  {req.has_risk_indicator && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/40 text-red-400 font-medium">
                      ⚠️ Non-official email
                    </span>
                  )}
                </div>
              </div>

              <div className="text-xs text-slate-500 space-y-1 mt-2">
                {req.department_type && <p>🏛 Type: <span className="text-slate-300">{req.department_type}</span></p>}
                {req.department_name && <p>📋 Dept: <span className="text-slate-300">{req.department_name}</span></p>}
                {req.designation && <p>👤 <span className="text-slate-300">{req.designation}</span>{req.badge_number && ` · ${req.badge_number}`}</p>}
                {req.official_email_domain && <p>📧 Domain: <span className={req.official_email_domain.includes('.gov') || req.official_email_domain.includes('.org') ? 'text-green-400' : 'text-orange-400'}>{req.official_email_domain}</span></p>}
                {req.office_address && <p>📍 {req.office_address}</p>}
                <p>📅 Submitted: {new Date(req.created_at).toLocaleDateString()}</p>
              </div>

              {req.admin_note && (
                <div className="mt-3 p-2 bg-slate-800 rounded text-xs text-slate-300">
                  <span className="text-slate-500">Admin note: </span>{req.admin_note}
                </div>
              )}
              {req.rejection_reason && req.status === 'rejected' && (
                <div className="mt-2 p-2 bg-red-900/20 border border-red-700/30 rounded text-xs text-red-300">
                  <span className="text-red-500">Rejection reason: </span>{req.rejection_reason}
                </div>
              )}

              {/* Expand for actions */}
              {selected?.id === req.id && req.status === 'pending' && (
                <div className="mt-4 pt-4 border-t border-slate-700 flex gap-2 flex-wrap">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleApprove(req.id); }}
                    disabled={submitting}
                    className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white text-sm rounded-lg font-medium transition-colors"
                  >
                    ✅ Approve
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setRejectModal(req.id); }}
                    className="px-4 py-2 bg-red-900/60 hover:bg-red-900 text-red-300 text-sm rounded-lg font-medium transition-colors"
                  >
                    ❌ Reject
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setInfoModal(req.id); }}
                    className="px-4 py-2 bg-blue-900/40 hover:bg-blue-900/70 text-blue-300 text-sm rounded-lg font-medium transition-colors"
                  >
                    📬 Request Info
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">Reject Authority Request</h3>
            <p className="text-slate-400 text-sm mb-3">Provide a reason — the authority will be notified.</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Unable to verify official credentials..."
              rows={4}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleReject}
                disabled={submitting}
                className="flex-1 py-2 bg-red-700 hover:bg-red-600 text-white text-sm rounded-lg font-medium"
              >
                {submitting ? 'Rejecting...' : 'Confirm Reject'}
              </button>
              <button
                onClick={() => { setRejectModal(null); setRejectReason(''); }}
                className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Info Modal */}
      {infoModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">Request Additional Information</h3>
            <p className="text-slate-400 text-sm mb-3">The authority will receive a notification with your message.</p>
            <textarea
              value={infoMessage}
              onChange={e => setInfoMessage(e.target.value)}
              placeholder="e.g. Please provide your official government ID and department letter..."
              rows={4}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleRequestInfo}
                disabled={submitting}
                className="flex-1 py-2 bg-blue-700 hover:bg-blue-600 text-white text-sm rounded-lg font-medium"
              >
                {submitting ? 'Sending...' : 'Send Request'}
              </button>
              <button
                onClick={() => { setInfoModal(null); setInfoMessage(''); }}
                className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Monthly Trend Analytics ───────────────────────────────────────────────────
function MonthlyTrends() {
  const [trend, setTrend] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({ category_id: '', months: 12 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    categoriesAPI.getAll()
      .then(({ data }) => setCategories(data.data?.categories || data.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    adminAPI.getMonthlyTrend(filters)
      .then(({ data }) => setTrend(data.data?.trend || []))
      .catch(() => toast.error('Failed to load trend data'))
      .finally(() => setLoading(false));
  }, [filters]);

  const totalReports = trend.reduce((sum, t) => sum + t.count, 0);
  const maxMonth = trend.reduce((max, t) => t.count > (max?.count || 0) ? t : max, null);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Monthly Trend Analytics</h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filters.category_id}
          onChange={e => setFilters(p => ({ ...p, category_id: e.target.value }))}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm"
        >
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={filters.months}
          onChange={e => setFilters(p => ({ ...p, months: e.target.value }))}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm"
        >
          <option value={3}>Last 3 months</option>
          <option value={6}>Last 6 months</option>
          <option value={12}>Last 12 months</option>
          <option value={24}>Last 24 months</option>
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-xs">Total in Period</p>
          <p className="text-2xl font-bold text-blue-400">{totalReports}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-xs">Monthly Average</p>
          <p className="text-2xl font-bold text-purple-400">
            {trend.length > 0 ? Math.round(totalReports / trend.length) : 0}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-xs">Peak Month</p>
          <p className="text-lg font-bold text-orange-400">{maxMonth?.month || '—'}</p>
          {maxMonth && <p className="text-xs text-slate-500">{maxMonth.count} reports</p>}
        </div>
      </div>

      {/* Main chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <h3 className="text-base font-semibold text-slate-200 mb-4">
          Reports per Month
          {filters.category_id && (
            <span className="text-sm font-normal text-slate-400 ml-2">
              — {categories.find(c => String(c.id) === String(filters.category_id))?.name}
            </span>
          )}
        </h3>
        {loading ? (
          <div className="h-64 flex items-center justify-center text-slate-400">Loading chart...</div>
        ) : trend.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-slate-400">
            No data for selected filters
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(v) => [v, 'Reports']}
              />
              <Area
                type="monotone" dataKey="count"
                stroke="#3b82f6" fill="url(#blueGrad)" strokeWidth={2.5}
                dot={{ fill: '#3b82f6', r: 4 }} activeDot={{ r: 6 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Monthly breakdown table */}
      {trend.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-slate-300">Monthly Breakdown</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="px-5 py-2 text-left text-xs text-slate-400">Month</th>
                <th className="px-5 py-2 text-right text-xs text-slate-400">Reports</th>
                <th className="px-5 py-2 text-right text-xs text-slate-400">vs Average</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {[...trend].reverse().map(t => {
                const avg = totalReports / trend.length;
                const diff = t.count - avg;
                return (
                  <tr key={t.month} className="hover:bg-slate-800/40">
                    <td className="px-5 py-2 text-sm text-slate-300">{t.month}</td>
                    <td className="px-5 py-2 text-sm text-slate-200 text-right font-medium">{t.count}</td>
                    <td className={`px-5 py-2 text-xs text-right ${diff > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {diff > 0 ? '+' : ''}{Math.round(diff)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Categories Manager ────────────────────────────────────────────────────────
function CategoriesManager() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', description: '' });
  const [editing, setEditing] = useState(null);

  useEffect(() => { fetchCategories(); }, []);

  const fetchCategories = () => {
    setLoading(true);
    categoriesAPI.getAll()
      .then(({ data }) => setCategories(data.data?.categories || data.data || []))
      .finally(() => setLoading(false));
  };

  const handleSave = async () => {
    if (!form.name) { toast.error('Name required'); return; }
    try {
      if (editing) {
        await adminAPI.updateCategory(editing, form);
        toast.success('Category updated');
      } else {
        await adminAPI.createCategory(form);
        toast.success('Category created');
      }
      setForm({ name: '', description: '' });
      setEditing(null);
      fetchCategories();
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this category?')) return;
    try {
      await adminAPI.deleteCategory(id);
      toast.success('Deleted');
      fetchCategories();
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed'); }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Categories Management</h2>
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <h3 className="font-semibold text-slate-200 mb-3">{editing ? 'Edit Category' : 'Add Category'}</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="Category name"
            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:border-blue-500" />
          <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Description (optional)"
            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:border-blue-500" />
          <button onClick={handleSave}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">
            {editing ? 'Update' : 'Create'}
          </button>
          {editing && (
            <button onClick={() => { setEditing(null); setForm({ name: '', description: '' }); }}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg">Cancel</button>
          )}
        </div>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        {loading ? <div className="p-8 text-center text-slate-400">Loading...</div> : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase hidden md:table-cell">Description</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {categories.map(c => (
                <tr key={c.id} className="hover:bg-slate-800/40">
                  <td className="px-5 py-3 text-sm text-slate-200 font-medium">{c.name}</td>
                  <td className="px-5 py-3 text-sm text-slate-400 hidden md:table-cell">{c.description || '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.is_active ? 'bg-green-900/40 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => { setEditing(c.id); setForm({ name: c.name, description: c.description || '' }); }}
                        className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg">Edit</button>
                      <button onClick={() => handleDelete(c.id)}
                        className="text-xs px-3 py-1.5 bg-red-900/40 hover:bg-red-900/70 text-red-400 rounded-lg">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Unassigned Reports ────────────────────────────────────────────────────────
function UnassignedReports() {
  const [reports, setReports] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(null); // reportId being assigned
  const [selections, setSelections] = useState({}); // { reportId: department_id }
  const [notes, setNotes] = useState({});

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      adminAPI.getUnassignedReports().then(({ data }) => setReports(data.data?.reports || [])),
      departmentsAPI.getAll().then(({ data }) => setDepartments(data.data?.departments || data.data || [])),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleAssign = async (reportId) => {
    const deptId = selections[reportId];
    if (!deptId) { toast.error('Select a department first'); return; }
    setAssigning(reportId);
    try {
      const { data } = await adminAPI.assignDepartment(reportId, {
        department_id: deptId,
        note: notes[reportId] || null,
      });
      toast.success(`Assigned to ${data.data.department_name}`);
      setReports(prev => prev.filter(r => r.id !== reportId));
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Assignment failed');
    } finally {
      setAssigning(null);
    }
  };

  const PRIORITY_COLOR = {
    critical: 'text-red-400', high: 'text-orange-400',
    medium: 'text-yellow-400', low: 'text-green-400',
  };

  if (loading) return <div className="text-slate-400 p-8 text-center">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Unassigned Reports</h2>
          <p className="text-sm text-slate-400 mt-1">
            Reports that couldn't be auto-assigned (no routing rule matched their category).
          </p>
        </div>
        <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${
          reports.length > 0 ? 'bg-red-900/40 text-red-400' : 'bg-green-900/40 text-green-400'
        }`}>
          {reports.length} pending
        </span>
      </div>

      {reports.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-slate-300 font-medium">All reports are assigned</p>
          <p className="text-slate-500 text-sm mt-1">No unassigned reports in the queue</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map(r => (
            <div key={r.id} className="bg-slate-900 border border-slate-700 rounded-xl p-5">
              {/* Report header */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <code className="text-xs bg-slate-800 text-blue-400 px-2 py-0.5 rounded font-mono">
                      {r.tracking_id}
                    </code>
                    <span className={`text-xs font-semibold uppercase ${PRIORITY_COLOR[r.priority] || 'text-slate-400'}`}>
                      {r.priority || 'medium'}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-300 rounded-full">{r.status}</span>
                    {r.category_name && (
                      <span className="text-xs px-2 py-0.5 bg-indigo-900/40 text-indigo-300 rounded-full">
                        {r.category_name}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-100 font-semibold">{r.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    By {r.reporter_name} · {new Date(r.submitted_at || r.created_at).toLocaleString()}
                  </p>
                </div>
                <span className="text-xs px-2 py-1 bg-amber-900/40 text-amber-400 rounded-full shrink-0 font-medium">
                  Unassigned
                </span>
              </div>

              {/* Manual assignment controls */}
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  value={selections[r.id] || ''}
                  onChange={e => setSelections(p => ({ ...p, [r.id]: e.target.value }))}
                  className="flex-1 min-w-[180px] px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Select department...</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <input
                  value={notes[r.id] || ''}
                  onChange={e => setNotes(p => ({ ...p, [r.id]: e.target.value }))}
                  placeholder="Note (optional)"
                  className="flex-1 min-w-[140px] px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:border-blue-500 focus:outline-none"
                />
                <button
                  onClick={() => handleAssign(r.id)}
                  disabled={assigning === r.id || !selections[r.id]}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                >
                  {assigning === r.id ? 'Assigning...' : 'Assign'}
                </button>
              </div>

              {/* Hint: why auto-assign failed */}
              {!r.category_id ? (
                <p className="text-xs text-amber-500 mt-2">⚠ No category set — auto-assignment skipped</p>
              ) : (
                <p className="text-xs text-slate-500 mt-2">
                  No routing rule found for <span className="text-slate-300">"{r.category_name}"</span>.
                  Add a rule in{' '}
                  <a href="/admin/mappings" className="text-blue-400 hover:underline">Routing Rules</a>{' '}
                  to auto-assign future reports.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Routing Rules ─────────────────────────────────────────────────────────────
function MappingRules() {
  const [mappings, setMappings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({ category_id: '', department_id: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminAPI.getMappings().then(({ data }) => setMappings(data.data?.rules || [])),
      categoriesAPI.getAll().then(({ data }) => setCategories(data.data?.categories || data.data || [])),
      departmentsAPI.getAll().then(({ data }) => setDepartments(data.data?.departments || data.data || [])),
    ]).finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!form.category_id || !form.department_id) { toast.error('Select both category and department'); return; }
    try {
      await adminAPI.createMapping(form);
      toast.success('Mapping created');
      const { data } = await adminAPI.getMappings();
      setMappings(data.data?.rules || []);
      setForm({ category_id: '', department_id: '' });
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed'); }
  };

  const handleDelete = async (id) => {
    try {
      await adminAPI.deleteMapping(id);
      setMappings(p => p.filter(m => m.id !== id));
      toast.success('Deleted');
    } catch { toast.error('Failed'); }
  };

  if (loading) return <div className="text-slate-400 p-8 text-center">Loading...</div>;

  const mappedCategoryIds = new Set(mappings.map(m => String(m.category_id)));
  const unmappedCategories = categories.filter(c => !mappedCategoryIds.has(String(c.id)));

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Routing Rules</h2>

      {unmappedCategories.length > 0 && (
        <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-4">
          <p className="text-sm font-semibold text-amber-400 mb-2">
            ⚠️ {unmappedCategories.length} categor{unmappedCategories.length === 1 ? 'y has' : 'ies have'} no routing rule
          </p>
          <p className="text-xs text-amber-300/70 mb-3">
            Reports in these categories will not be auto-assigned and will appear in the Unassigned Reports queue.
          </p>
          <div className="flex flex-wrap gap-2">
            {unmappedCategories.map(c => (
              <button key={c.id}
                onClick={() => setForm(p => ({ ...p, category_id: String(c.id) }))}
                className="text-xs px-2.5 py-1 bg-amber-900/40 border border-amber-700/50 text-amber-300 rounded-full hover:bg-amber-800/50 transition-colors">
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <h3 className="font-semibold text-slate-200 mb-3">Add Category → Department Mapping</h3>
        <div className="flex flex-wrap gap-3">
          <select value={form.category_id} onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm">
            <option value="">Select Category</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}{!mappedCategoryIds.has(String(c.id)) ? ' ⚠️' : ''}
              </option>
            ))}
          </select>
          <select value={form.department_id} onChange={e => setForm(p => ({ ...p, department_id: e.target.value }))}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm">
            <option value="">Select Department</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button onClick={handleCreate}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">
            Add Rule
          </button>
        </div>
        {mappings.length > 0 ? (
          <table className="w-full mt-4">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="py-2 px-3 text-left text-xs text-slate-400">Category</th>
                <th className="py-2 px-3 text-left text-xs text-slate-400">Department</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {mappings.map(m => (
                <tr key={m.id} className="hover:bg-slate-800/40">
                  <td className="py-2 px-3 text-sm text-slate-300">{m.category_name}</td>
                  <td className="py-2 px-3 text-sm text-slate-300">{m.department_name}</td>
                  <td className="py-2 px-3">
                    <button onClick={() => handleDelete(m.id)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-500 mt-4">No routing rules yet. Add one above to enable auto-assignment.</p>
        )}
      </div>
    </div>
  );
}

// ── Users Manager ─────────────────────────────────────────────────────────────
function UsersManager() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ role: '', page: 1 });

  useEffect(() => {
    setLoading(true);
    adminAPI.getUsers(filters)
      .then(({ data }) => setUsers(data.data?.users || []))
      .finally(() => setLoading(false));
  }, [filters]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">User Management</h2>
      <select value={filters.role} onChange={e => setFilters(p => ({ ...p, role: e.target.value, page: 1 }))}
        className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm">
        <option value="">All Roles</option>
        <option value="reporter">Reporters</option>
        <option value="authority">Authorities</option>
        <option value="admin">Admins</option>
      </select>
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        {loading ? <div className="p-8 text-center text-slate-400">Loading...</div> : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">User</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Role</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase hidden md:table-cell">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase hidden md:table-cell">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-800/40">
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-slate-200">{u.name}</p>
                    <p className="text-xs text-slate-400">{u.email}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                      ${u.role === 'admin' ? 'bg-purple-900/40 text-purple-400'
                        : u.role === 'authority' ? 'bg-blue-900/40 text-blue-400'
                        : 'bg-slate-700 text-slate-300'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3 hidden md:table-cell">
                    <span className={`text-xs ${u.is_active ? (u.is_verified ? 'text-green-400' : 'text-yellow-400') : 'text-red-400'}`}>
                      {!u.is_active ? '🔴 Inactive' : u.is_verified ? '✅ Verified' : '⏳ Pending'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-400 hidden md:table-cell">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Duplicate Flags ───────────────────────────────────────────────────────────
function DuplicateFlags() {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    adminAPI.getDuplicateFlags()
      .then(({ data }) => setFlags(data.data?.flags || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDismiss = async (id) => {
    try {
      await adminAPI.dismissDuplicate(id);
      toast.success('Flag dismissed — report kept as unique');
      setFlags(prev => prev.filter(f => f.id !== id));
    } catch { toast.error('Failed'); }
  };

  const handleConfirm = async (flag) => {
    try {
      await adminAPI.confirmDuplicate(flag.id, { original_id: flag.possible_duplicate_of });
      toast.success('Confirmed as duplicate — report closed');
      setFlags(prev => prev.filter(f => f.id !== flag.id));
    } catch { toast.error('Failed'); }
  };

  if (loading) return <div className="text-slate-400 p-8 text-center">Loading...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold text-white">Possible Duplicates</h2>
        {flags.length > 0 && (
          <span className="text-xs px-2 py-0.5 bg-orange-900/40 text-orange-400 border border-orange-700/40 rounded-full font-medium">
            {flags.length} flagged
          </span>
        )}
      </div>

      {flags.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-10 text-center">
          <div className="text-3xl mb-3">✅</div>
          <p className="text-slate-400">No duplicate flags at this time.</p>
          <p className="text-xs text-slate-600 mt-1">
            Reports are flagged when a submission matches an existing report within 48 h and 300 m.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {flags.map(flag => (
            <div key={flag.id} className="bg-slate-900 border border-orange-700/30 rounded-lg p-5 space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <span className="text-xs px-2 py-0.5 bg-orange-900/40 text-orange-400 border border-orange-700/40 rounded-full">
                    Possible Duplicate
                  </span>
                  <h3 className="text-sm font-semibold text-white mt-2">
                    {flag.title || '(Untitled)'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {flag.tracking_id} · {flag.category_name} ·{' '}
                    {flag.submitted_at ? new Date(flag.submitted_at).toLocaleString() : '—'}
                  </p>
                </div>
                <Link to={`/reports/${flag.id}`}
                  className="text-xs text-blue-400 hover:text-blue-300 whitespace-nowrap">
                  View Report →
                </Link>
              </div>

              {/* Similarity info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-800 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-0.5">Similar to</p>
                  <p className="text-sm text-slate-200 font-medium truncate">
                    {flag.orig_title || '(Untitled)'}
                  </p>
                  <Link to={`/reports/${flag.possible_duplicate_of}`}
                    className="text-xs text-blue-400 hover:text-blue-300">
                    {flag.orig_tracking_id} →
                  </Link>
                </div>
                <div className="bg-slate-800 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-0.5">Distance apart</p>
                  <p className="text-sm font-semibold text-slate-200">
                    {flag.distance_meters != null ? `${flag.distance_meters} m` : 'No GPS data'}
                  </p>
                  <p className="text-xs text-slate-500">threshold: 300 m</p>
                </div>
                <div className="bg-slate-800 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-0.5">Time apart</p>
                  <p className="text-sm font-semibold text-slate-200">
                    {flag.hours_apart != null
                      ? `${Math.abs(flag.hours_apart)} h`
                      : '—'}
                  </p>
                  <p className="text-xs text-slate-500">threshold: 48 h</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button onClick={() => handleConfirm(flag)}
                  className="px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white text-sm font-medium rounded-lg">
                  Confirm Duplicate &amp; Close
                </button>
                <button onClick={() => handleDismiss(flag.id)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg">
                  Dismiss — Keep Separate
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── All Reports (Admin) ───────────────────────────────────────────────────────
const STATUS_COLORS = {
  'Draft': 'bg-slate-700 text-slate-300',
  'Submitted': 'bg-blue-900/40 text-blue-400',
  'Under Review': 'bg-yellow-900/40 text-yellow-400',
  'Investigating': 'bg-orange-900/40 text-orange-400',
  'Resolved': 'bg-green-900/40 text-green-400',
  'Closed': 'bg-slate-700 text-slate-400',
};

function AllReports() {
  const [reports, setReports] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ page: 1, limit: 20, status: '', search: '' });
  const [assigning, setAssigning] = useState({});

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      reportsAPI.getAll(filters).then(({ data }) => {
        setReports(data.data?.reports || []);
        setTotal(data.data?.total || 0);
      }),
      departments.length === 0
        ? departmentsAPI.getAll().then(({ data }) => setDepartments(data.data?.departments || data.data || []))
        : Promise.resolve(),
    ]).finally(() => setLoading(false));
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const openAssign = (reportId) => {
    const report = reports.find(r => r.id === reportId);
    setAssigning(prev => ({
      ...prev,
      [reportId]: {
        open: true,
        dept_id: report?.assigned_department_id ? String(report.assigned_department_id) : '',
        note: '',
      },
    }));
  };

  const closeAssign = (reportId) =>
    setAssigning(prev => ({ ...prev, [reportId]: { ...prev[reportId], open: false } }));

  const handleAssign = async (reportId) => {
    const state = assigning[reportId];
    if (!state?.dept_id) { toast.error('Select a department'); return; }
    try {
      await adminAPI.assignDepartment(reportId, { department_id: state.dept_id, note: state.note });
      const deptName = departments.find(d => String(d.id) === String(state.dept_id))?.name || '';
      toast.success(`Assigned to ${deptName}`);
      setReports(prev => prev.map(r =>
        r.id === reportId ? { ...r, assigned_department_id: state.dept_id, department_name: deptName } : r
      ));
      closeAssign(reportId);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to assign');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-bold text-white">
          All Reports <span className="text-sm font-normal text-slate-400 ml-2">{total} total</span>
        </h2>
        <div className="flex gap-2 flex-wrap">
          <input
            type="text" placeholder="Search title or ID..."
            value={filters.search}
            onChange={e => setFilters(p => ({ ...p, search: e.target.value, page: 1 }))}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm w-48"
          />
          <select value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value, page: 1 }))}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm">
            <option value="">All Statuses</option>
            {['Submitted', 'Under Review', 'Investigating', 'Resolved', 'Closed'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : reports.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No reports found.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Title</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase hidden md:table-cell">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Department</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase hidden md:table-cell">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase hidden lg:table-cell">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {reports.map(r => (
                <tr key={r.id} className="hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-slate-400">{r.tracking_id}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/reports/${r.id}`} className="text-sm text-blue-400 hover:text-blue-300 line-clamp-1">
                      {r.title || '(Untitled)'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs text-slate-400">{r.category_name || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    {assigning[r.id]?.open ? (
                      <div className="space-y-1.5">
                        <select
                          value={assigning[r.id]?.dept_id || ''}
                          onChange={e => setAssigning(prev => ({
                            ...prev, [r.id]: { ...prev[r.id], dept_id: e.target.value }
                          }))}
                          className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-slate-100 text-xs">
                          <option value="">Select department</option>
                          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        <input
                          type="text" placeholder="Note (optional)"
                          value={assigning[r.id]?.note || ''}
                          onChange={e => setAssigning(prev => ({
                            ...prev, [r.id]: { ...prev[r.id], note: e.target.value }
                          }))}
                          className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-slate-100 text-xs"
                        />
                        <div className="flex gap-1.5">
                          <button onClick={() => handleAssign(r.id)}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded">
                            Save
                          </button>
                          <button onClick={() => closeAssign(r.id)}
                            className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 group">
                        <span className={`text-xs ${r.department_name ? 'text-slate-300' : 'text-slate-500 italic'}`}>
                          {r.department_name || 'Unassigned'}
                        </span>
                        <button onClick={() => openAssign(r.id)}
                          className={`text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity
                            ${r.department_name
                              ? 'bg-slate-700 text-slate-400 hover:text-slate-200'
                              : 'bg-amber-900/40 border border-amber-700/50 text-amber-300 hover:bg-amber-800/50 opacity-100'}`}>
                          {r.department_name ? 'Change' : 'Assign'}
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status] || 'bg-slate-700 text-slate-300'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 hidden lg:table-cell">
                    {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {total > filters.limit && (
        <div className="flex justify-center gap-2">
          <button disabled={filters.page <= 1}
            onClick={() => setFilters(p => ({ ...p, page: p.page - 1 }))}
            className="px-3 py-1.5 bg-slate-800 text-slate-300 text-sm rounded-lg disabled:opacity-40 hover:bg-slate-700">
            Prev
          </button>
          <span className="px-3 py-1.5 text-slate-400 text-sm">
            Page {filters.page} of {Math.ceil(total / filters.limit)}
          </span>
          <button disabled={filters.page >= Math.ceil(total / filters.limit)}
            onClick={() => setFilters(p => ({ ...p, page: p.page + 1 }))}
            className="px-3 py-1.5 bg-slate-800 text-slate-300 text-sm rounded-lg disabled:opacity-40 hover:bg-slate-700">
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard Layout ─────────────────────────────────────────────────────
const NAV_ITEMS = [
  { path: '/admin', label: '📊 Overview', exact: true },
  { path: '/admin/reports', label: '📋 All Reports' },
  { path: '/admin/authority-review', label: '🔍 Authority Review' },
  { path: '/admin/unassigned', label: '⚠️ Unassigned Reports' },
  { path: '/admin/duplicates', label: '🔁 Duplicates' },
  { path: '/admin/trends', label: '📈 Monthly Trends' },
  { path: '/admin/categories', label: '📂 Categories' },
  { path: '/admin/mappings', label: '🗺 Routing Rules' },
  { path: '/admin/users', label: '👥 Users' },
  { path: '/compliance', label: '⚖️ Compliance', external: true },
];

export default function AdminDashboard() {
  const location = useLocation();

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="w-52 shrink-0 hidden md:block">
            <nav className="space-y-1">
              {NAV_ITEMS.map(item => {
                const isActive = !item.external && (item.exact
                  ? location.pathname === '/admin'
                  : location.pathname.startsWith(item.path));
                return (
                  <Link key={item.path} to={item.path}
                    className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors
                      ${isActive ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}
                      ${item.external ? 'border-t border-slate-800 mt-2 pt-4' : ''}`}>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          {/* Mobile nav */}
          <div className="md:hidden flex gap-2 overflow-x-auto pb-2 mb-4 w-full">
            {NAV_ITEMS.map(item => (
              <Link key={item.path} to={item.path}
                className={`whitespace-nowrap px-3 py-2 rounded-lg text-xs font-medium transition-colors
                  ${location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path))
                    ? 'bg-blue-600/20 text-blue-400' : 'bg-slate-800 text-slate-400'}`}>
                {item.label}
              </Link>
            ))}
          </div>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            <Routes>
              <Route index element={<Overview />} />
              <Route path="reports" element={<AllReports />} />
              <Route path="authority-review" element={<AuthorityReviewPanel />} />
              <Route path="unassigned" element={<UnassignedReports />} />
              <Route path="duplicates" element={<DuplicateFlags />} />
              <Route path="trends" element={<MonthlyTrends />} />
              <Route path="categories" element={<CategoriesManager />} />
              <Route path="mappings" element={<MappingRules />} />
              <Route path="users" element={<UsersManager />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
}
