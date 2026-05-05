import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { departmentsAPI } from '../services/api';
import toast from 'react-hot-toast';

const DEPT_TYPES = ['Police', 'Legal', 'Cyber', 'Fire', 'Infrastructure', 'Other'];

function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="text-xl font-semibold text-slate-200">
            CivicShield
          </Link>

          <h1 className="text-2xl font-semibold mt-6 text-slate-200">
            {title}
          </h1>

          <p className="text-slate-400 text-sm mt-2">
            {subtitle}
          </p>
        </div>

        <div className="border border-slate-800 rounded-lg p-8 bg-slate-950">
          {children}
        </div>
      </div>
    </div>
  );
}

export function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Login: Submitting login form', { email: form.email });

    if (!form.email || !form.password) {
      return toast.error('Please fill in all fields.');
    }

    setLoading(true);

    try {
      console.log('Login: Calling login API');
      const { user } = await login(form.email, form.password);
      console.log('Login: Login successful', { user, role: user.role });

      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);

      if (user.role === 'admin') {
        navigate('/admin');
      } else if (user.role === 'authority') {
        navigate('/authority');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Login: Login failed', err);
      toast.error(err.response?.data?.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  console.log('Login: Component loaded, handleSubmit function:', typeof handleSubmit);

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your CivicShield account"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="text-sm text-slate-400 mb-1 block">
            Email Address
          </label>

          <input
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={(e) =>
              setForm((p) => ({ ...p, email: e.target.value }))
            }
            className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-slate-600"
            autoComplete="email"
          />
        </div>

        <div>
          <label className="text-sm text-slate-400 mb-1 block">
            Password
          </label>

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={form.password}
              onChange={(e) =>
                setForm((p) => ({ ...p, password: e.target.value }))
              }
              className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm pr-10 focus:outline-none focus:border-slate-600"
              autoComplete="current-password"
            />

            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-slate-800 hover:bg-slate-700 transition rounded py-2 text-sm font-medium"
          onClick={() => console.log('Login: Button clicked')}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <p className="text-center text-slate-500 text-sm mt-6">
        Don't have an account?{' '}
        <Link to="/register" className="text-slate-300 hover:underline">
          Create one
        </Link>
      </p>
    </AuthLayout>
  );
}

export function Register() {
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '', role: 'reporter', phone: '',
    // Authority-only fields
    department_id: '', department_type: '', designation: '', badge_number: '', office_address: '',
  });
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false); // authority pending screen

  const { register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    departmentsAPI.getAll()
      .then(({ data }) => setDepartments(data.data?.departments || data.data || []))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password)
      return toast.error('Please fill in all required fields.');
    if (form.password !== form.confirmPassword)
      return toast.error('Passwords do not match.');
    if (form.password.length < 8)
      return toast.error('Password must be at least 8 characters.');
    if (form.role === 'authority' && !form.department_id)
      return toast.error('Please select your department.');
    if (form.role === 'authority' && !form.department_type)
      return toast.error('Please select a department type.');

    setLoading(true);
    try {
      const result = await register(form);
      if (result?.pendingApproval) {
        setSubmitted(true); // show waiting screen
      } else {
        toast.success('Account created successfully!');
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  // Authority pending approval screen
  if (submitted) {
    return (
      <AuthLayout title="Application Submitted" subtitle="Your authority account is pending review">
        <div className="text-center space-y-4">
          <div className="text-5xl">⏳</div>
          <p className="text-slate-300 text-sm leading-relaxed">
            Your application has been submitted to the admin for verification.
            You will be notified once your account is approved.
          </p>
          <div className="p-3 bg-slate-900 border border-slate-700 rounded-lg text-left text-xs text-slate-400 space-y-1">
            <p><span className="text-slate-300">Name:</span> {form.name}</p>
            <p><span className="text-slate-300">Email:</span> {form.email}</p>
            <p><span className="text-slate-300">Department:</span> {departments.find(d => String(d.id) === String(form.department_id))?.name || '—'}</p>
            <p><span className="text-slate-300">Type:</span> {form.department_type}</p>
            {form.designation && <p><span className="text-slate-300">Designation:</span> {form.designation}</p>}
          </div>
          <Link to="/login" className="block text-sm text-indigo-400 hover:text-indigo-300 mt-2">
            ← Back to Login
          </Link>
        </div>
      </AuthLayout>
    );
  }

  const roleOptions = [
    { value: 'reporter',  label: 'Citizen',    desc: 'File & track reports' },
    { value: 'authority', label: 'Authority',   desc: 'Govt. / Dept. officer' },
  ];

  return (
    <AuthLayout title="Create account" subtitle="Join CivicShield to report incidents securely">
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Basic fields */}
        <div>
          <label className="text-sm text-slate-400 mb-1 block">Full Name *</label>
          <input type="text" placeholder="John Doe" value={form.name} onChange={set('name')}
            className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="text-sm text-slate-400 mb-1 block">Email Address *</label>
          <input type="email" placeholder="you@example.com" value={form.email} onChange={set('email')}
            className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="text-sm text-slate-400 mb-1 block">Phone Number</label>
          <input type="tel" placeholder="+880 1234 567890" value={form.phone} onChange={set('phone')}
            className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm" />
        </div>

        {/* Account type */}
        <div>
          <label className="text-sm text-slate-400 mb-2 block">Account Type</label>
          <div className="grid grid-cols-2 gap-3">
            {roleOptions.map(({ value, label, desc }) => (
              <button key={value} type="button"
                onClick={() => setForm(p => ({ ...p, role: value }))}
                className={`p-3 rounded border text-left text-sm transition-colors ${
                  form.role === value ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800 hover:border-slate-700'
                }`}>
                <div className="font-medium">{label}</div>
                <div className="text-xs text-slate-500">{desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Authority-only institutional fields */}
        {form.role === 'authority' && (
          <div className="space-y-3 border border-slate-700 rounded-lg p-4 bg-slate-900/50">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Institutional Information</p>
            <p className="text-xs text-slate-500">This will be reviewed by admin before your account is activated.</p>

            <div>
              <label className="text-sm text-slate-400 mb-1 block">Department *</label>
              <select value={form.department_id} onChange={set('department_id')}
                className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100">
                <option value="">Select your department</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-sm text-slate-400 mb-1 block">Department Type *</label>
              <select value={form.department_type} onChange={set('department_type')}
                className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100">
                <option value="">Select type</option>
                {DEPT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Designation</label>
                <input value={form.designation} onChange={set('designation')}
                  placeholder="e.g. Inspector"
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Badge Number</label>
                <input value={form.badge_number} onChange={set('badge_number')}
                  placeholder="e.g. BD-PD-001"
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm" />
              </div>
            </div>

            <div>
              <label className="text-sm text-slate-400 mb-1 block">Office Address</label>
              <input value={form.office_address} onChange={set('office_address')}
                placeholder="Physical office location"
                className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm" />
            </div>
          </div>
        )}

        {/* Password */}
        <div className="grid grid-cols-2 gap-3">
          <input type={showPassword ? 'text' : 'password'} placeholder="Password"
            value={form.password} onChange={set('password')}
            className="bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm" />
          <input type={showPassword ? 'text' : 'password'} placeholder="Confirm"
            value={form.confirmPassword} onChange={set('confirmPassword')}
            className="bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm" />
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-500">
          <input type="checkbox" checked={showPassword} onChange={() => setShowPassword(!showPassword)} />
          Show passwords
        </label>

        <button type="submit" disabled={loading}
          className="w-full bg-slate-800 hover:bg-slate-700 transition rounded py-2 text-sm font-medium disabled:opacity-50">
          {loading
            ? (form.role === 'authority' ? 'Submitting application...' : 'Creating account...')
            : (form.role === 'authority' ? 'Submit Application' : 'Create Account')}
        </button>
      </form>

      <p className="text-center text-slate-500 text-sm mt-6">
        Already have an account?{' '}
        <Link to="/login" className="text-slate-300 hover:underline">Sign in</Link>
      </p>
    </AuthLayout>
  );
}

export default Login;
