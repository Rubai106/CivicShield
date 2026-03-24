import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { reportsAPI } from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const STATUS_CONFIG = {
  draft: { label: 'Draft', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-300' },
  submitted: { label: 'Submitted', bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-300' },
  under_review: { label: 'Under Review', bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-300' },
  investigating: { label: 'Investigating', bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-300' },
  resolved: { label: 'Resolved', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-300' },
  closed: { label: 'Closed', bg: 'bg-slate-500/10', border: 'border-slate-500/30', text: 'text-slate-300' },
};

const WORKFLOW_STEPS = [
  { key: 'submitted', label: 'Submitted' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'investigating', label: 'Investigating' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' },
];

export default function ReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    reportsAPI
      .getById(id)
      .then(({ data }) => {
        setReport(data.data.report);
        setEvidence(data.data.evidence || []);
      })
      .catch(() => {
        toast.error('Failed to load report');
        navigate(-1);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center py-24"><div className="w-8 h-8 spinner" /></div>
      </div>
    );
  }

  if (!report) return null;

  const statusInfo = STATUS_CONFIG[report.status] || STATUS_CONFIG.submitted;
  const currentStepIndex = WORKFLOW_STEPS.findIndex((s) => s.key === report.status);
  const nextStep = currentStepIndex >= 0 && currentStepIndex < WORKFLOW_STEPS.length - 1
    ? WORKFLOW_STEPS[currentStepIndex + 1]
    : null;

  const handleStatusUpdate = async () => {
    if (!nextStep || updatingStatus) return;
    setUpdatingStatus(true);
    try {
      const { data } = await reportsAPI.updateStatus(id, nextStep.key);
      setReport(data.data.report);
      toast.success(`Status updated to "${nextStep.label}"`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />

      <div className="max-w-screen-lg mx-auto px-4 py-8 page-enter">
        <button onClick={() => navigate(-1)} className="text-sm text-slate-400 hover:text-slate-200 mb-4">
          ← Back
        </button>

        {/* Header card — title, tracking ID, status badge */}
        <div className="card p-6 mb-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-semibold text-slate-100">{report.title}</h1>
              <p className="text-xs text-slate-500 mt-1">Tracking ID: <span className="font-mono text-indigo-400">{report.tracking_id}</span></p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusInfo.bg} ${statusInfo.border} ${statusInfo.text}`}>
              {statusInfo.label}
            </span>
          </div>

          {report.incident_date && (
            <p className="text-xs text-slate-500 mt-3">
              Incident: {new Date(report.incident_date).toLocaleString()}
            </p>
          )}

          <div className="flex gap-2 flex-wrap mt-3 text-xs text-slate-400">
            {report.category_name && <span className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08]">{report.category_name}</span>}
            {report.department_name && <span className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08]">{report.department_name}</span>}
            <span className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08]">
              Reporter: {report.reporter_name || 'Hidden'}
            </span>
          </div>

          {report.reporter_email && (
            <p className="text-xs text-slate-500 mt-2">Reporter Email: {report.reporter_email}</p>
          )}
        </div>

        {/* Status workflow timeline */}
        {report.status !== 'draft' && (
          <div className="card p-6 mb-5">
            <h2 className="text-slate-200 font-medium mb-4">Status Timeline</h2>
            <div className="flex items-center gap-0 overflow-x-auto pb-2">
              {WORKFLOW_STEPS.map((step, idx) => {
                const isCompleted = idx < currentStepIndex;
                const isCurrent = idx === currentStepIndex;
                const isPending = idx > currentStepIndex;

                return (
                  <div key={step.key} className="flex items-center">
                    <div className="flex flex-col items-center min-w-[90px]">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors ${isCompleted
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                            : isCurrent
                              ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300'
                              : 'bg-white/[0.03] border-white/[0.1] text-slate-600'
                          }`}
                      >
                        {isCompleted ? '✓' : idx + 1}
                      </div>
                      <span
                        className={`text-[10px] mt-1.5 text-center leading-tight ${isCurrent ? 'text-indigo-300 font-medium' : isCompleted ? 'text-emerald-400' : 'text-slate-600'
                          }`}
                      >
                        {step.label}
                      </span>
                    </div>
                    {idx < WORKFLOW_STEPS.length - 1 && (
                      <div
                        className={`h-0.5 w-6 sm:w-10 mt-[-14px] ${isCompleted ? 'bg-emerald-500/50' : 'bg-white/[0.08]'
                          }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Authority: update status button */}
            {user?.role === 'authority' && nextStep && (
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={handleStatusUpdate}
                  disabled={updatingStatus}
                  className="btn-primary text-sm disabled:opacity-50"
                >
                  {updatingStatus ? 'Updating...' : `Move to → ${nextStep.label}`}
                </button>
                <span className="text-xs text-slate-500">
                  Current: {statusInfo.label}
                </span>
              </div>
            )}
            {user?.role === 'authority' && !nextStep && report.status === 'closed' && (
              <p className="mt-4 text-xs text-slate-500">This report has reached its final status.</p>
            )}
          </div>
        )}

        {/* Description + location */}
        <div className="card p-6 mb-5">
          <h2 className="text-slate-200 font-medium mb-2">Description</h2>
          <p className="text-slate-300 text-sm whitespace-pre-wrap">{report.description}</p>

          {report.location_text && (
            <div className="mt-4">
              <h3 className="text-slate-200 font-medium text-sm mb-1">Location</h3>
              <p className="text-slate-400 text-sm">{report.location_text}</p>
              {(report.location_lat || report.location_lng) && (
                <p className="text-xs text-slate-500 mt-1">{report.location_lat}, {report.location_lng}</p>
              )}
            </div>
          )}
        </div>

        {/* Evidence */}
        <div className="card p-6">
          <h2 className="text-slate-200 font-medium mb-3">Evidence ({evidence.length})</h2>

          {evidence.length === 0 ? (
            <p className="text-sm text-slate-500">No evidence uploaded.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {evidence.map((ev) => (
                <a
                  key={ev.id}
                  href={ev.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-3 rounded border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
                >
                  <p className="text-sm text-slate-200 truncate">{ev.file_name || 'Evidence file'}</p>
                  <p className="text-xs text-slate-500 mt-1">{ev.file_type || 'unknown type'}</p>
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5">
          <Link to="/dashboard" className="text-sm text-indigo-400 hover:text-indigo-300">
            ← Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
