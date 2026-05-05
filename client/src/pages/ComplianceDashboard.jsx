import { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
import Navbar from '../components/Navbar';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import toast from 'react-hot-toast';

const PRIORITY_COLORS = { Critical: '#dc2626', High: '#f97316', Medium: '#3b82f6', Low: '#6b7280' };
const PIE_COLORS = ['#dc2626', '#f97316', '#3b82f6', '#6b7280'];

function RiskBadge({ level }) {
  const styles = {
    low: 'bg-green-900/40 text-green-400 border border-green-800',
    medium: 'bg-yellow-900/40 text-yellow-400 border border-yellow-800',
    high: 'bg-red-900/40 text-red-400 border border-red-800',
  };
  const icons = { low: '🟢', medium: '🟡', high: '🔴' };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[level] || styles.low}`}>
      {icons[level]} {level?.toUpperCase()} RISK
    </span>
  );
}

function StatCard({ label, value, sub, color = 'text-blue-400', icon }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
      {icon && <div className="text-2xl mb-2">{icon}</div>}
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-sm text-slate-400 mt-1">{label}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function SLATable({ departments, onEditSLA }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">SLA Compliance by Department</h3>
        <span className="text-xs text-slate-500">Click a row to edit SLA</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase">
              <th className="px-4 py-2 text-left">Department</th>
              <th className="px-4 py-2 text-center">Risk</th>
              <th className="px-4 py-2 text-right">Total</th>
              <th className="px-4 py-2 text-right">Active</th>
              <th className="px-4 py-2 text-right">SLA Met</th>
              <th className="px-4 py-2 text-right">Breached</th>
              <th className="px-4 py-2 text-right">Avg Time</th>
              <th className="px-4 py-2 text-right">SLA Days</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {departments.map(d => (
              <tr
                key={d.department_id}
                onClick={() => onEditSLA(d)}
                className="hover:bg-slate-800/50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 text-sm font-medium text-slate-200">{d.department_name}</td>
                <td className="px-4 py-3 text-center"><RiskBadge level={d.risk_level} /></td>
                <td className="px-4 py-3 text-sm text-slate-300 text-right">{d.total_cases}</td>
                <td className="px-4 py-3 text-sm text-orange-400 text-right font-medium">{d.active_cases}</td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm text-green-400 font-medium">{d.sla_met_rate}%</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`text-sm font-medium ${d.sla_breach_rate > 30 ? 'text-red-400' : 'text-slate-400'}`}>
                    {d.sla_breach_rate}%
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-400 text-right">
                  {d.avg_resolution_hours != null
                    ? d.avg_resolution_hours >= 24
                      ? `${(d.avg_resolution_hours / 24).toFixed(1)}d`
                      : `${d.avg_resolution_hours}h`
                    : '—'}
                </td>
                <td className="px-4 py-3 text-sm text-slate-400 text-right">{d.sla_days}d</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditSLAModal({ dept, onClose, onSave }) {
  const [days, setDays] = useState(dept?.sla_days || 5);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminAPI.setSLARule({ department_id: dept.department_id, resolution_days: days });
      toast.success(`SLA for ${dept.department_name} set to ${days} days`);
      onSave();
      onClose();
    } catch { toast.error('Failed to save SLA rule'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm">
        <h3 className="text-lg font-semibold text-white mb-1">Edit SLA Rule</h3>
        <p className="text-slate-400 text-sm mb-4">{dept?.department_name}</p>
        <label className="block text-sm text-slate-300 mb-1">Resolution deadline (days)</label>
        <input
          type="number" min={1} max={90} value={days}
          onChange={e => setDays(parseInt(e.target.value) || 1)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm mb-4"
        />
        <div className="flex gap-3">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium">
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={onClose}
            className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ComplianceDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editSLADept, setEditSLADept] = useState(null);

  const fetchData = () => {
    setLoading(true);
    adminAPI.getComplianceDashboard()
      .then(({ data: res }) => setData(res.data))
      .catch(() => toast.error('Failed to load compliance data'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center h-64 text-slate-400">Loading compliance data...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center h-64 text-slate-400">No data available. Run migrations first.</div>
      </div>
    );
  }

  const {
    departments = [],
    pending_load = [],
    priority_distribution = [],
    overall_sla_met_rate,
    high_risk_count,
    overdue_cases = [],
  } = data;

  // Bar chart data for SLA comparison
  const slaChartData = departments.map(d => ({
    name: d.department_name.replace(' Department', '').replace(' Unit', ''),
    'SLA Met %': d.sla_met_rate,
    'Breached %': d.sla_breach_rate,
  }));

  // Avg resolution time chart
  const resolutionData = departments
    .filter(d => d.avg_resolution_hours != null)
    .map(d => ({
      name: d.department_name.replace(' Department', '').replace(' Unit', ''),
      'Avg Days': parseFloat((d.avg_resolution_hours / 24).toFixed(1)),
    }));

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">⚖️ Compliance & Risk Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">System-level performance monitoring across all departments</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Overall SLA Met Rate" icon="✅"
            value={`${overall_sla_met_rate}%`}
            color={overall_sla_met_rate >= 70 ? 'text-green-400' : overall_sla_met_rate >= 50 ? 'text-yellow-400' : 'text-red-400'}
          />
          <StatCard
            label="High Risk Departments" icon="🔴"
            value={high_risk_count}
            color={high_risk_count > 0 ? 'text-red-400' : 'text-green-400'}
            sub={high_risk_count > 0 ? 'Needs attention' : 'All good'}
          />
          <StatCard
            label="Total Active Cases" icon="🔍"
            value={departments.reduce((s, d) => s + d.active_cases, 0)}
            color="text-orange-400"
          />
          <StatCard
            label="Departments Monitored" icon="🏛"
            value={departments.length}
            color="text-blue-400"
          />
        </div>

        {/* SLA Compliance Table */}
        <div className="mb-8">
          <SLATable departments={departments} onEditSLA={setEditSLADept} />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* SLA Met vs Breached bar chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">SLA Performance Comparison</h3>
            {slaChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={slaChartData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                    formatter={(v) => [`${v}%`]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                  <Bar dataKey="SLA Met %" fill="#22c55e" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Breached %" fill="#ef4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-60 flex items-center justify-center text-slate-500 text-sm">
                No resolved cases yet to compare
              </div>
            )}
          </div>

          {/* Priority distribution pie */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">Priority Distribution</h3>
            {priority_distribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={priority_distribution}
                    dataKey="count"
                    nameKey="priority"
                    cx="50%" cy="50%"
                    outerRadius={80}
                    label={({ priority, count }) => `${priority}: ${count}`}
                    labelLine={{ stroke: '#475569' }}
                  >
                    {priority_distribution.map((entry, i) => (
                      <Cell
                        key={entry.priority}
                        fill={PRIORITY_COLORS[entry.priority] || PIE_COLORS[i % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-60 flex items-center justify-center text-slate-500 text-sm">No reports yet</div>
            )}
          </div>
        </div>

        {/* Average resolution time + Pending load */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Avg resolution time */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">Average Resolution Time (days)</h3>
            {resolutionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={resolutionData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis type="number" stroke="#64748b" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" stroke="#64748b" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                    formatter={(v) => [`${v} days`]}
                  />
                  <Bar dataKey="Avg Days" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-52 flex items-center justify-center text-slate-500 text-sm">
                No resolved cases yet
              </div>
            )}
          </div>

          {/* Pending case load */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-4">Pending Case Load</h3>
            <div className="space-y-3">
              {pending_load.map(d => {
                const max = Math.max(...pending_load.map(x => x.pending_count), 1);
                const pct = (d.pending_count / max) * 100;
                const color = d.pending_count > 20 ? 'bg-red-500' : d.pending_count > 10 ? 'bg-yellow-500' : 'bg-blue-500';
                return (
                  <div key={d.department_id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-300">
                        {d.department_name.replace(' Department', '').replace(' Unit', '')}
                      </span>
                      <span className={`font-medium ${d.pending_count > 20 ? 'text-red-400' : d.pending_count > 10 ? 'text-yellow-400' : 'text-slate-400'}`}>
                        {d.pending_count} cases
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2">
                      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Overdue / Ignored Cases */}
        {overdue_cases.length > 0 && (
          <div className="bg-red-950/30 border border-red-800/40 rounded-lg p-5 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-sm font-semibold text-red-400">🚨 Overdue Cases — No activity in 72+ hours</h3>
              <span className="text-xs px-2 py-0.5 bg-red-900/50 text-red-300 rounded-full">{overdue_cases.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-red-900/40 text-xs text-slate-400 uppercase">
                    <th className="px-3 py-2 text-left">Tracking ID</th>
                    <th className="px-3 py-2 text-left">Title</th>
                    <th className="px-3 py-2 text-left hidden md:table-cell">Department</th>
                    <th className="px-3 py-2 text-left">Priority</th>
                    <th className="px-3 py-2 text-right">Hours Open</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-900/20">
                  {overdue_cases.map(c => (
                    <tr key={c.tracking_id} className="hover:bg-red-900/10">
                      <td className="px-3 py-2 font-mono text-xs text-blue-400">{c.tracking_id}</td>
                      <td className="px-3 py-2 text-sm text-slate-300 max-w-[200px] truncate">{c.title}</td>
                      <td className="px-3 py-2 text-xs text-slate-400 hidden md:table-cell">{c.department || 'Unassigned'}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium
                          ${c.priority === 'Critical' ? 'bg-red-900/40 text-red-400'
                            : c.priority === 'High' ? 'bg-orange-900/40 text-orange-400'
                            : c.priority === 'Medium' ? 'bg-yellow-900/40 text-yellow-400'
                            : 'bg-slate-700 text-slate-400'}`}>
                          {c.priority}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm text-red-400 font-medium text-right">
                        {c.hours_open >= 24
                          ? `${(c.hours_open / 24).toFixed(1)}d`
                          : `${c.hours_open}h`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Risk summary cards */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Department Risk Summary</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {departments.map(d => (
              <div key={d.department_id} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm font-medium text-slate-200 leading-tight">
                    {d.department_name}
                  </p>
                  <RiskBadge level={d.risk_level} />
                </div>
                <div className="space-y-1 text-xs text-slate-400">
                  <div className="flex justify-between">
                    <span>SLA Met</span>
                    <span className="text-green-400 font-medium">{d.sla_met_rate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Breached</span>
                    <span className={d.sla_breach_rate > 30 ? 'text-red-400 font-medium' : 'text-slate-400'}>
                      {d.sla_breach_rate}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active</span>
                    <span className="text-orange-400 font-medium">{d.active_cases}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {editSLADept && (
        <EditSLAModal dept={editSLADept} onClose={() => setEditSLADept(null)} onSave={fetchData} />
      )}
    </div>
  );
}
