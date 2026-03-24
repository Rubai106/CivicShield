import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center page-enter">
        <div className="text-8xl font-black text-white/[0.04] mb-4 font-display">404</div>
        <h1 className="text-2xl font-display font-semibold text-slate-100 mb-2">Page Not Found</h1>
        <p className="text-slate-400 mb-6">The page you're looking for doesn't exist or has been moved.</p>
        <Link to="/" className="btn-primary inline-flex items-center gap-2 text-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          Go Home
        </Link>
      </div>
    </div>
  );
}
