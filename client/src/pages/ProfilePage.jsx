import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { authAPI, departmentsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const DEPT_TYPES = ['Police', 'Legal', 'Cyber', 'Fire', 'Infrastructure', 'Other'];

// Officer role options per department type
const OFFICER_ROLES = {
  Police:         ['Police Officer', 'Sub-Inspector', 'Inspector', 'Superintendent', 'Constable'],
  Legal:          ['Lawyer', 'Legal Advisor', 'Public Prosecutor', 'Legal Officer'],
  Cyber:          ['Cyber Crime Investigator', 'Digital Forensics Officer', 'Cyber Security Analyst'],
  Fire:           ['Fire Fighter', 'Fire Safety Officer', 'Fire Inspector', 'Station Officer'],
  Infrastructure: ['Civil Engineer', 'Infrastructure Inspector', 'Project Officer', 'Road Safety Officer'],
  Other:          ['Officer', 'Senior Officer', 'Supervisor', 'Director'],
};

const STATUS_CONFIG = {
  pending:        { label: 'Pending Verification', color: 'text-yellow-400', bg: 'bg-yellow-900/30 border-yellow-700/50', icon: '⏳' },
  approved:       { label: 'Verified & Active',     color: 'text-green-400',  bg: 'bg-green-900/30 border-green-700/50',  icon: '✅' },
  rejected:       { label: 'Verification Failed',   color: 'text-red-400',    bg: 'bg-red-900/30 border-red-700/50',      icon: '❌' },
  info_requested: { label: 'Info Requested',         color: 'text-blue-400',   bg: 'bg-blue-900/30 border-blue-700/50',    icon: '📬' },
};

export default function ProfilePage() {
  const { user, logout, loadUser } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('profile');

  // Profile tab
  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '', avatar_url: user?.avatar_url || '' });

  // Security tab
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  // Onboarding tab
  const [departments, setDepartments] = useState([]);
  const [onboardStatus, setOnboardStatus] = useState(null); // current request from DB
  const [authorityProfile, setAuthorityProfile] = useState(null);
  const [onboardForm, setOnboardForm] = useState({
    department_id: '', badge_number: '', designation: '',
    department_type: '', official_email_domain: '', office_address: '',
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.role === 'authority') {
      departmentsAPI.getAll()
        .then(({ data }) => setDepartments(data.data?.departments || data.data || []))
        .catch(() => {});
      authAPI.getOnboardingStatus()
        .then(({ data }) => {
          const req = data.data?.request;
          const profile = data.data?.profile;
          setOnboardStatus(req);
          setAuthorityProfile(profile);
          if (req) {
            setOnboardForm({
              department_id: req.department_id || '',
              badge_number: req.badge_number || '',
              designation: req.designation || '',
              department_type: req.department_type || '',
              official_email_domain: req.official_email_domain || '',
              office_address: req.office_address || '',
            });
          }
        })
        .catch(() => {});
    }
  }, [user]);

  const handleProfileSave = async () => {
    setSaving(true);
    try {
      await authAPI.updateProfile(form);
      if (loadUser) await loadUser();
      toast.success('Profile updated');
    } catch { toast.error('Failed to update profile'); }
    finally { setSaving(false); }
  };

  const handlePasswordChange = async () => {
    if (pwForm.newPassword !== pwForm.confirmPassword) { toast.error('Passwords do not match'); return; }
    if (pwForm.newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setSaving(true);
    try {
      await authAPI.changePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      toast.success('Password changed');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleOnboard = async () => {
    if (!onboardForm.department_id) { toast.error('Select a department'); return; }
    if (!onboardForm.department_type) { toast.error('Select a department type'); return; }
    if (!onboardForm.designation) { toast.error('Select your officer role'); return; }
    setSaving(true);
    try {
      await authAPI.onboardAuthority(onboardForm);
      toast.success('Onboarding submitted! Awaiting admin verification.');
      // Refresh status
      const { data } = await authAPI.getOnboardingStatus();
      setOnboardStatus(data.data?.request);
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const TABS = ['profile', 'security', ...(user?.role === 'authority' ? ['onboarding'] : [])];

  const statusInfo = onboardStatus ? (STATUS_CONFIG[onboardStatus.status] || STATUS_CONFIG.pending) : null;

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Profile Header */}
        <div className="card p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold shrink-0">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white truncate">{user?.name}</h1>
              <p className="text-slate-400 text-sm">{user?.email}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                  ${user?.role === 'admin' ? 'bg-purple-900/40 text-purple-400'
                    : user?.role === 'authority' ? 'bg-blue-900/40 text-blue-400'
                    : 'bg-slate-700 text-slate-300'}`}>
                  {user?.role}
                </span>
                {/* Show department name from approved profile */}
                {authorityProfile?.department_name && (
                  <span className="text-xs text-slate-400">
                    {authorityProfile.department_name}
                    {authorityProfile.designation && ` · ${authorityProfile.designation}`}
                  </span>
                )}
                {user?.is_verified && <span className="text-xs text-green-400">✓ Verified</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Verification status banner for authority */}
        {user?.role === 'authority' && statusInfo && (
          <div className={`border rounded-xl p-4 mb-6 ${statusInfo.bg}`}>
            <div className="flex items-center gap-2">
              <span className="text-lg">{statusInfo.icon}</span>
              <div>
                <p className={`font-semibold text-sm ${statusInfo.color}`}>{statusInfo.label}</p>
                {onboardStatus?.status === 'approved' && authorityProfile?.department_id && (
                  <p className="text-xs text-slate-300 mt-0.5">
                    {authorityProfile.department_name} — {authorityProfile.designation || 'Officer'}
                  </p>
                )}
                {onboardStatus?.status === 'approved' && !authorityProfile?.department_id && (
                  <p className="text-xs text-amber-300 mt-0.5">
                    Account verified — apply for a department role in the Onboarding tab
                  </p>
                )}
                {onboardStatus?.status === 'rejected' && (
                  <p className="text-xs text-red-300 mt-0.5">
                    Access Denied. Reason: {onboardStatus.rejection_reason || 'No reason provided.'}
                  </p>
                )}
                {onboardStatus?.status === 'info_requested' && (
                  <p className="text-xs text-blue-300 mt-0.5">
                    Admin message: {onboardStatus.admin_note}
                  </p>
                )}
                {onboardStatus?.status === 'pending' && (
                  <p className="text-xs text-slate-400 mt-0.5">Your application is under review. We'll notify you once a decision is made.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-900 rounded-xl p-1">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg capitalize transition-colors
                ${tab === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
              {t === 'onboarding' ? 'Onboarding' : t}
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {tab === 'profile' && (
          <div className="card p-6 space-y-4">
            <h2 className="font-semibold text-slate-200">Edit Profile</h2>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Phone</label>
              <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                placeholder="+880 1234 567890"
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Avatar URL</label>
              <input value={form.avatar_url} onChange={e => setForm(p => ({ ...p, avatar_url: e.target.value }))}
                placeholder="https://..."
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleProfileSave} disabled={saving}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={() => { logout(); navigate('/'); }}
                className="px-5 py-2.5 bg-red-900/40 hover:bg-red-900/60 text-red-400 text-sm rounded-lg transition-colors ml-auto">
                Sign Out
              </button>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {tab === 'security' && (
          <div className="card p-6 space-y-4">
            <h2 className="font-semibold text-slate-200">Change Password</h2>
            {[
              { key: 'currentPassword', label: 'Current Password' },
              { key: 'newPassword', label: 'New Password' },
              { key: 'confirmPassword', label: 'Confirm New Password' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
                <input type="password" value={pwForm[key]}
                  onChange={e => setPwForm(p => ({ ...p, [key]: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
            ))}
            <button onClick={handlePasswordChange} disabled={saving}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
              {saving ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        )}

        {/* Onboarding Tab (Authority only) */}
        {tab === 'onboarding' && (
          <div className="space-y-5">

            {/* Rejected state — show blocked message prominently */}
            {onboardStatus?.status === 'rejected' && (
              <div className="card p-5 border border-red-700/50 bg-red-900/10">
                <h3 className="font-semibold text-red-400 text-base mb-1">Verification Failed · Access Denied</h3>
                <p className="text-sm text-slate-300">
                  Your onboarding application was rejected.
                  {onboardStatus.rejection_reason && (
                    <> Reason: <span className="text-red-300">{onboardStatus.rejection_reason}</span></>
                  )}
                </p>
                <p className="text-xs text-slate-500 mt-2">You may resubmit with corrected information.</p>
              </div>
            )}

            {/* Approved WITH department — show profile summary */}
            {onboardStatus?.status === 'approved' && authorityProfile?.department_id && (
              <div className="card p-5 border border-green-700/50 bg-green-900/10">
                <h3 className="font-semibold text-green-400 text-base mb-3">Verified & Active</h3>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  {[
                    ['Department', authorityProfile.department_name],
                    ['Type', authorityProfile.department_type],
                    ['Role', authorityProfile.designation],
                    ['Badge No.', authorityProfile.badge_number],
                  ].filter(([, v]) => v).map(([label, val]) => (
                    <div key={label}>
                      <span className="text-slate-500 text-xs">{label}</span>
                      <p className="text-slate-200 font-medium">{val}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Approved WITHOUT department — prompt them to apply for a role */}
            {onboardStatus?.status === 'approved' && !authorityProfile?.department_id && (
              <div className="card p-4 border border-amber-700/50 bg-amber-900/10">
                <p className="text-amber-400 font-semibold text-sm">No department assigned yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  Your account is verified. Apply for a department role below — admin will review and assign you.
                </p>
              </div>
            )}

            {/* Onboarding form — show when: not yet submitted, rejected, info_requested, OR approved-but-no-dept */}
            {(onboardStatus?.status !== 'approved' || !authorityProfile?.department_id) && (
              <div className="card p-6 space-y-4">
                <div>
                  <h2 className="font-semibold text-slate-200">
                    {onboardStatus?.status === 'approved' ? 'Apply for Department Role' : 'Authority Onboarding'}
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    {onboardStatus?.status === 'approved'
                      ? 'Your account is verified. Select your department and role — admin will review and assign you.'
                      : 'Submit your institutional details for admin verification. Only verified departments can operate inside the system.'}
                  </p>
                </div>

                {/* Department */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Department *</label>
                  <select value={onboardForm.department_id}
                    onChange={e => setOnboardForm(p => ({ ...p, department_id: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:border-blue-500 focus:outline-none">
                    <option value="">Select your department</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>

                {/* Department type */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Department Type *</label>
                  <select value={onboardForm.department_type}
                    onChange={e => setOnboardForm(p => ({ ...p, department_type: e.target.value, designation: '' }))}
                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:border-blue-500 focus:outline-none">
                    <option value="">Select type</option>
                    {DEPT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* Official email domain */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Official Email Domain
                    <span className="ml-1 text-xs text-slate-500">(e.g. @police.gov.bd)</span>
                  </label>
                  <input value={onboardForm.official_email_domain}
                    onChange={e => setOnboardForm(p => ({ ...p, official_email_domain: e.target.value }))}
                    placeholder="@police.gov.bd"
                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:border-blue-500 focus:outline-none" />
                  {onboardForm.official_email_domain && !onboardForm.official_email_domain.includes('.gov') &&
                   !onboardForm.official_email_domain.includes('.org') && !onboardForm.official_email_domain.includes('.edu') && (
                    <p className="text-xs text-orange-400 mt-1">⚠️ Non-official domain detected. This may flag your application for extra review.</p>
                  )}
                </div>

                {/* Role / Designation — dropdown driven by department type */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Officer Role *</label>
                  {onboardForm.department_type ? (
                    <select value={onboardForm.designation}
                      onChange={e => setOnboardForm(p => ({ ...p, designation: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:border-blue-500 focus:outline-none">
                      <option value="">Select your role</option>
                      {(OFFICER_ROLES[onboardForm.department_type] || OFFICER_ROLES.Other).map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-slate-500 px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg">
                      Select a department type first to see available roles
                    </p>
                  )}
                </div>

                {/* Badge number */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Badge / ID Number</label>
                  <input value={onboardForm.badge_number}
                    onChange={e => setOnboardForm(p => ({ ...p, badge_number: e.target.value }))}
                    placeholder="e.g. BD-PD-12345"
                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:border-blue-500 focus:outline-none" />
                </div>

                {/* Office address */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Physical Office Address</label>
                  <textarea value={onboardForm.office_address}
                    onChange={e => setOnboardForm(p => ({ ...p, office_address: e.target.value }))}
                    rows={2}
                    placeholder="Full office address..."
                    className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:border-blue-500 focus:outline-none resize-none" />
                </div>

                <button onClick={handleOnboard} disabled={saving}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                  {saving
                    ? 'Submitting...'
                    : onboardStatus?.status === 'approved'
                      ? 'Apply for Department Role'
                      : onboardStatus
                        ? 'Resubmit for Verification'
                        : 'Submit for Verification'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
