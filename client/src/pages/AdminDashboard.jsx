import { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { adminAPI, categoriesAPI, departmentsAPI } from '../services/api';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';

// ── Sub-pages ─────────────────────────────────────────────────────────────────

function Overview() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.getAnalytics().then(({ data }) => setAnalytics({
        totalReports: data.data?.summary?.total || 0,
        activeCases: data.data?.summary?.open || 0,
        resolved: data.data?.summary?.resolved || 0,
        critical: 0,
        totalUsers: data.data?.summary?.total_users || 0,
        totalAuthorities: 0,
        monthlyTrend: (data.data?.monthly_trend || []).map(m => ({ month: m.month, count: parseInt(m.count) })),
        byCategory: (data.data?.category_distribution || []).map(c => ({ name: c.name, count: parseInt(c.count) })),
      })).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-400 p-8 text-center">Loading analytics...</div>;

  const kpis = [
    { label: 'Total Reports', value: analytics?.totalReports || 0, icon: '📋', color: 'text-blue-400' },
    { label: 'Active Cases', value: analytics?.activeCases || 0, icon: '🔍', color: 'text-orange-400' },
    { label: 'Resolved', value: analytics?.resolved || 0, icon: '✅', color: 'text-green-400' },
    { label: 'Critical', value: analytics?.critical || 0, icon: '🚨', color: 'text-red-400' },
    { label: 'Total Users', value: analytics?.totalUsers || 0, icon: '👥', color: 'text-purple-400' },
    { label: 'Authorities', value: analytics?.totalAuthorities || 0, icon: '🏛', color: 'text-yellow-400' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">System Overview</h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="card p-5">
            <div className="text-2xl mb-2">{k.icon}</div>
            <div className={`text-3xl font-bold ${k.color}`}>{k.value}</div>
            <div className="text-sm text-slate-400 mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      {analytics?.monthlyTrend?.length > 0 && (
        <div className="card p-5">
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
        <div className="card p-5">
          <h3 className="text-base font-semibold text-slate-200 mb-4">Reports by Category</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={analytics.byCategory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ background: '#1a2035', border: '1px solid #334155', borderRadius: 8 }} />
              <Bar dataKey="count" fill="#6366f1" radius={[4,4,0,0]} name="Reports" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function CategoriesManager() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', description: '' });
  const [editing, setEditing] = useState(null);

  useEffect(() => { fetchCategories(); }, []);

  const fetchCategories = () => {
    setLoading(true);
    categoriesAPI.getAll().then(({ data }) => setCategories(data.data?.categories || data.data || [])).finally(() => setLoading(false));
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
      <div className="card p-5">
        <h3 className="font-semibold text-slate-200 mb-3">{editing ? 'Edit Category' : 'Add Category'}</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Category name"
            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:border-blue-500" />
          <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Description (optional)"
            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:border-blue-500" />
          <button onClick={handleSave}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
            {editing ? 'Update' : 'Create'}
          </button>
          {editing && <button onClick={() => { setEditing(null); setForm({ name: '', description: '' }); }}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg">Cancel</button>}
        </div>
      </div>

      <div className="card overflow-hidden">
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

function MappingRules() {
  const [mappings, setMappings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [slaRules, setSlaRules] = useState([]);
  const [form, setForm] = useState({ category_id: '', department_id: '', priority_rule: 'Medium', keywords: '' });
  const [slaForm, setSlaForm] = useState({ category_id: '', hours_to_resolve: 72 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminAPI.getMappings().then(({ data }) => setMappings(data.data?.rules || data.data || [])),
      categoriesAPI.getAll().then(({ data }) => setCategories(data.data?.categories || data.data || [])),
      departmentsAPI.getAll().then(({ data }) => setDepartments(data.data?.departments || data.data || [])),
      adminAPI.getSLARules().then(({ data }) => setSlaRules(data.data?.rules || data.data || [])),
    ]).finally(() => setLoading(false));
  }, []);

  const handleCreateMapping = async () => {
    if (!form.category_id || !form.department_id) { toast.error('Select category and department'); return; }
    try {
      await adminAPI.createMapping(form);
      toast.success('Mapping created');
      const { data } = await adminAPI.getMappings();
      setMappings(data.data?.rules || data.data || []);
      setForm({ category_id: '', department_id: '', priority_rule: 'Medium', keywords: '' });
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed'); }
  };

  const handleDeleteMapping = async (id) => {
    try { await adminAPI.deleteMapping(id); setMappings(p => p.filter(m => m.id !== id)); toast.success('Deleted'); }
    catch { toast.error('Failed'); }
  };

  const handleSaveSLA = async () => {
    if (!slaForm.category_id) { toast.error('Select category'); return; }
    try {
      await adminAPI.setSLARule(slaForm);
      toast.success('SLA rule saved');
      const { data } = await adminAPI.getSLARules();
      setSlaRules(data.data?.rules || data.data || []);
    } catch { toast.error('Failed'); }
  };

  if (loading) return <div className="text-slate-400 p-8 text-center">Loading...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Routing Rules & SLA</h2>

      {/* Mapping Form */}
      <div className="card p-5">
        <h3 className="font-semibold text-slate-200 mb-3">Add Category → Department Mapping</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <select value={form.category_id} onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm">
            <option value="">Select Category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={form.department_id} onChange={e => setForm(p => ({ ...p, department_id: e.target.value }))}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm">
            <option value="">Select Department</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={form.priority_rule} onChange={e => setForm(p => ({ ...p, priority_rule: e.target.value }))}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm">
            {['Low','Medium','High','Critical'].map(p => <option key={p} value={p}>{p} Priority</option>)}
          </select>
          <button onClick={handleCreateMapping}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
            Add Rule
          </button>
        </div>
        {mappings.length > 0 && (
          <table className="w-full mt-4">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="py-2 px-3 text-left text-xs text-slate-400">Category</th>
                <th className="py-2 px-3 text-left text-xs text-slate-400">Department</th>
                <th className="py-2 px-3 text-left text-xs text-slate-400">Priority</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {mappings.map(m => (
                <tr key={m.id} className="hover:bg-slate-800/40">
                  <td className="py-2 px-3 text-sm text-slate-300">{m.category_name}</td>
                  <td className="py-2 px-3 text-sm text-slate-300">{m.department_name}</td>
                  <td className="py-2 px-3 text-sm text-slate-300">{m.priority_rule}</td>
                  <td className="py-2 px-3">
                    <button onClick={() => handleDeleteMapping(m.id)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* SLA Rules */}
      <div className="card p-5">
        <h3 className="font-semibold text-slate-200 mb-3">SLA Rules (Target Resolution Time)</h3>
        <div className="flex gap-3 mb-4">
          <select value={slaForm.category_id} onChange={e => setSlaForm(p => ({ ...p, category_id: e.target.value }))}
            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm">
            <option value="">Select Category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input type="number" value={slaForm.hours_to_resolve} min={1} max={8760}
            onChange={e => setSlaForm(p => ({ ...p, hours_to_resolve: e.target.value }))}
            className="w-36 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm" placeholder="Hours" />
          <button onClick={handleSaveSLA}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg">Save</button>
        </div>
        {slaRules.length > 0 && (
          <div className="space-y-2">
            {slaRules.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                <span className="text-sm text-slate-300">{s.category_name}</span>
                <span className="text-sm text-slate-400">{s.hours_to_resolve}h target</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UsersManager() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ role: '', page: 1 });

  useEffect(() => {
    setLoading(true);
    adminAPI.getUsers(filters).then(({ data }) => setUsers(data.data?.users || [])).finally(() => setLoading(false));
  }, [filters]);

  const toggleVerify = async (userId, isVerified) => {
    try {
      await adminAPI.verifyAuthority(userId, { is_verified: !isVerified });
      setUsers(p => p.map(u => u.id === userId ? { ...u, is_verified: !isVerified } : u));
      toast.success(isVerified ? 'User unverified' : 'User verified');
    } catch { toast.error('Failed'); }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">User Management</h2>
      <div className="flex gap-3 mb-4">
        <select value={filters.role} onChange={e => setFilters(p => ({ ...p, role: e.target.value, page: 1 }))}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm">
          <option value="">All Roles</option>
          <option value="reporter">Reporters</option>
          <option value="authority">Authorities</option>
          <option value="admin">Admins</option>
        </select>
      </div>
      <div className="card overflow-hidden">
        {loading ? <div className="p-8 text-center text-slate-400">Loading...</div> : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">User</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Role</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase hidden md:table-cell">Status</th>
                <th className="px-5 py-3"></th>
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
                    <span className={`text-xs ${u.is_verified ? 'text-green-400' : 'text-yellow-400'}`}>
                      {u.is_verified ? '✓ Verified' : '⏳ Pending'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {u.role === 'authority' && (
                      <button onClick={() => toggleVerify(u.id, u.is_verified)}
                        className={`text-xs px-3 py-1.5 rounded-lg transition-colors
                          ${u.is_verified ? 'bg-yellow-900/40 text-yellow-400 hover:bg-yellow-900/60' : 'bg-green-900/40 text-green-400 hover:bg-green-900/60'}`}>
                        {u.is_verified ? 'Revoke' : 'Verify'}
                      </button>
                    )}
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

// ── Main Admin Dashboard Layout ───────────────────────────────────────────────

const NAV_ITEMS = [
  { path: '/admin', label: '📊 Overview', exact: true },
  { path: '/admin/categories', label: '📂 Categories' },
  { path: '/admin/mappings', label: '🗺 Routing Rules' },
  { path: '/admin/users', label: '👥 Users' },
];

export default function AdminDashboard() {
  const location = useLocation();

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex gap-8">
          {/* Sidebar Nav */}
          <aside className="w-48 shrink-0 hidden md:block">
            <nav className="space-y-1">
              {NAV_ITEMS.map(item => {
                const active = item.exact
                  ? location.pathname === item.path
                  : location.pathname.startsWith(item.path) && !item.exact ? location.pathname !== '/admin' : false;
                const isActive = item.exact
                  ? location.pathname === '/admin'
                  : location.pathname.startsWith(item.path);
                return (
                  <Link key={item.path} to={item.path}
                    className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors
                      ${isActive ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          {/* Mobile Nav */}
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

          {/* Content */}
          <main className="flex-1 min-w-0">
            <Routes>
              <Route index element={<Overview />} />
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
