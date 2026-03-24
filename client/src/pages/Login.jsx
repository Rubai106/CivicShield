import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

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

      if (user.role === 'authority') {
        console.log('Login: Navigating to authority dashboard');
        navigate('/authority');
      } else {
        console.log('Login: Navigating to reporter dashboard');
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
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'reporter',
    phone: '',
  });

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name || !form.email || !form.password) {
      return toast.error('Please fill in all required fields.');
    }

    if (form.password !== form.confirmPassword) {
      return toast.error('Passwords do not match.');
    }

    if (form.password.length < 8) {
      return toast.error('Password must be at least 8 characters.');
    }

    setLoading(true);

    try {
      const user = await register(form);

      toast.success('Account created successfully!');

      if (user.role === 'authority') navigate('/authority');
      else navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const roleOptions = [
    { value: 'reporter', label: 'Citizen', desc: 'File & track reports' },
    { value: 'authority', label: 'Authority', desc: 'Handle & resolve' },
  ];

  return (
    <AuthLayout
      title="Create account"
      subtitle="Join CivicShield to report incidents securely"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm text-slate-400 mb-1 block">
            Full Name *
          </label>

          <input
            type="text"
            placeholder="John Doe"
            value={form.name}
            onChange={(e) =>
              setForm((p) => ({ ...p, name: e.target.value }))
            }
            className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-sm text-slate-400 mb-1 block">
            Email Address *
          </label>

          <input
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={(e) =>
              setForm((p) => ({ ...p, email: e.target.value }))
            }
            className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-sm text-slate-400 mb-1 block">
            Phone Number
          </label>

          <input
            type="tel"
            placeholder="+1 234 567 8900"
            value={form.phone}
            onChange={(e) =>
              setForm((p) => ({ ...p, phone: e.target.value }))
            }
            className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-sm text-slate-400 mb-2 block">
            Account Type
          </label>

          <div className="grid grid-cols-2 gap-3">
            {roleOptions.map(({ value, label, desc }) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setForm((p) => ({ ...p, role: value }))
                }
                className={`p-3 rounded border text-left text-sm ${
                  form.role === value
                    ? 'border-slate-600 bg-slate-900'
                    : 'border-slate-800'
                }`}
              >
                <div className="font-medium">{label}</div>
                <div className="text-xs text-slate-500">{desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            value={form.password}
            onChange={(e) =>
              setForm((p) => ({ ...p, password: e.target.value }))
            }
            className="bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm"
          />

          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Confirm"
            value={form.confirmPassword}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                confirmPassword: e.target.value,
              }))
            }
            className="bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm"
          />
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-500">
          <input
            type="checkbox"
            checked={showPassword}
            onChange={() => setShowPassword(!showPassword)}
          />
          Show passwords
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-slate-800 hover:bg-slate-700 transition rounded py-2 text-sm font-medium"
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <p className="text-center text-slate-500 text-sm mt-6">
        Already have an account?{' '}
        <Link to="/login" className="text-slate-300 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}

export default Login;
