// Shared UI Components

export function StatusBadge({ status }) {
  const config = {
    draft: { label: 'Draft', bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20', dot: 'bg-slate-400' },
    submitted: { label: 'Submitted', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', dot: 'bg-blue-400' },
    under_review: { label: 'Under Review', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', dot: 'bg-amber-400' },
    investigating: { label: 'Investigating', bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20', dot: 'bg-orange-400' },
    resolved: { label: 'Resolved', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', dot: 'bg-emerald-400' },
    closed: { label: 'Closed', bg: 'bg-slate-500/10', text: 'text-slate-300', border: 'border-slate-500/20', dot: 'bg-slate-300' },
  };
  const c = config[status] || config.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${c.bg} ${c.text} border ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  const config = {
    critical: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', bars: 4 },
    high: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20', bars: 3 },
    medium: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', bars: 2 },
    low: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', bars: 1 },
  };
  const c = config[priority] || config.medium;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${c.bg} ${c.text} border ${c.border}`}>
      <span className="flex items-end gap-px h-3">
        {[1,2,3,4].map(i => (
          <span key={i} className={`w-[3px] rounded-full transition-all ${i <= c.bars ? 'bg-current' : 'bg-current/20'}`}
            style={{ height: `${4 + i * 2}px` }} />
        ))}
      </span>
      {priority?.charAt(0).toUpperCase() + priority?.slice(1)}
    </span>
  );
}

export function Spinner({ size = 'md' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' };
  return <div className={`${sizes[size]} spinner`} />;
}

export function LoadingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Spinner size="lg" />
        <p className="text-slate-500 text-sm">Loading...</p>
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center page-enter">
      <div className="w-16 h-16 bg-white/[0.03] border border-white/[0.06] rounded-2xl flex items-center justify-center mb-4 text-slate-500">
        {icon}
      </div>
      <h3 className="text-lg font-display font-semibold text-slate-300 mb-2">{title}</h3>
      <p className="text-slate-500 text-sm max-w-sm">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function StatCard({ icon, label, value, sub, color = 'indigo', trend }) {
  const colors = {
    indigo: 'from-indigo-500/20 to-indigo-600/5 border-indigo-500/20 text-indigo-400',
    green: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/20 text-emerald-400',
    red: 'from-red-500/20 to-red-600/5 border-red-500/20 text-red-400',
    orange: 'from-orange-500/20 to-orange-600/5 border-orange-500/20 text-orange-400',
    purple: 'from-violet-500/20 to-violet-600/5 border-violet-500/20 text-violet-400',
    yellow: 'from-amber-500/20 to-amber-600/5 border-amber-500/20 text-amber-400',
    cyan: 'from-cyan-500/20 to-cyan-600/5 border-cyan-500/20 text-cyan-400',
  };

  return (
    <div className={`card p-5 bg-gradient-to-br ${colors[color]} flex items-start gap-4 hover-glow`}>
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${colors[color].split(' ').slice(0, 2).join(' ')} border ${colors[color].split(' ')[2]} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-slate-100 mt-0.5 font-mono tracking-tight">{value}</p>
        {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs mt-1 ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d={trend >= 0 ? "M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" : "M4.5 4.5l15 15m0 0V8.25m0 11.25H8.25"} />
            </svg>
            {Math.abs(trend)}% from last month
          </div>
        )}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-8 slide-up">
      <div>
        <h1 className="text-2xl font-display font-semibold text-slate-100">{title}</h1>
        {subtitle && <p className="text-slate-500 mt-1 text-sm">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Confirm', danger = false }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="card p-6 w-full max-w-sm relative slide-up">
        <h3 className="text-lg font-display font-semibold text-slate-100 mb-2">{title}</h3>
        <p className="text-slate-500 text-sm mb-6">{message}</p>
        <div className="flex items-center gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 text-sm rounded-xl transition-colors">Cancel</button>
          <button onClick={onConfirm} className={danger ? 'px-4 py-2 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/20 text-sm rounded-xl font-medium transition-colors' : 'btn-primary text-sm'}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Timeline({ events }) {
  if (!events?.length) return null;
  return (
    <div className="space-y-0">
      {events.map((event, i) => (
        <div key={event.id || i} className="relative flex gap-3 pb-4 last:pb-0">
          <div className="flex flex-col items-center">
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 mt-1.5 shrink-0 ring-4 ring-[#0d1117]" />
            {i < events.length - 1 && <div className="w-px flex-1 bg-white/[0.06] mt-1" />}
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-slate-200 text-sm">{event.action}</p>
              <span className="text-xs text-slate-600 shrink-0">
                {new Date(event.created_at).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                })}
              </span>
            </div>
            {event.notes && <p className="text-slate-500 text-sm mt-0.5">{event.notes}</p>}
            {event.actor_name && (
              <p className="text-xs text-slate-600 mt-1">
                {event.actor_name}
                {event.actor_role && <span className="text-slate-700"> &middot; {event.actor_role}</span>}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function FilterBar({ filters, setFilters, options }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {options.map(({ key, label, choices }) => (
        <select
          key={key}
          value={filters[key] || ''}
          onChange={e => setFilters(prev => ({ ...prev, [key]: e.target.value, page: 1 }))}
          className="input-field py-2 text-sm w-auto min-w-[130px] cursor-pointer"
        >
          <option value="">{label}: All</option>
          {choices.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      ))}
    </div>
  );
}

export function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <button
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] disabled:opacity-30 text-slate-400 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
      </button>
      <span className="px-4 py-1.5 text-slate-500 text-sm font-mono">
        {page} <span className="text-slate-600">/</span> {totalPages}
      </span>
      <button
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] disabled:opacity-30 text-slate-400 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
      </button>
    </div>
  );
}
