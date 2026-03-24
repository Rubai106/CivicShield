import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout, isAuthority, isReporter } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const dashboardLink = '/dashboard';

  let navLinks = [];
  if (isReporter) {
    navLinks = [
      { to: '/dashboard', label: 'My Reports' },
      { to: '/reports/new', label: 'File Report' },
    ];
  } else if (isAuthority) {
    navLinks = [
        { to: '/dashboard', label: 'Dashboard' },
    ];
  }

  const isActive = (to) => location.pathname === to || location.pathname.startsWith(`${to}/`);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="sticky top-0 z-50 glass border-b border-white/[0.06]">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to={dashboardLink} className="font-semibold text-slate-100 text-lg">
          CivicShield
        </Link>

        <div className="flex items-center gap-2">
          {navLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                isActive(item.to)
                  ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                  : 'text-slate-400 border-white/[0.08] hover:text-slate-200 hover:bg-white/[0.05]'
              }`}
            >
              {item.label}
            </Link>
          ))}

          <span className="hidden sm:inline text-xs text-slate-500 px-2">
            {user?.name} ({user?.role})
          </span>

          <button
            onClick={handleLogout}
            className="px-3 py-1.5 text-sm rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
}
