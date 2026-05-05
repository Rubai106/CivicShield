import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { consultationsAPI, authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  'Pending': 'bg-yellow-900/30 text-yellow-400',
  'Confirmed': 'bg-blue-900/30 text-blue-400',
  'Completed': 'bg-green-900/30 text-green-400',
  'Cancelled': 'bg-red-900/30 text-red-400',
};

export default function ConsultationsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [consultations, setConsultations] = useState([]);
  const [authorities, setAuthorities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [form, setForm] = useState({ authority_id: '', description: '', scheduled_at: '', title: 'Consultation Request' });
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState(null);

  useEffect(() => {
    // Show toast on return from Stripe
    const payment = searchParams.get('payment');
    if (payment === 'success') toast.success('Payment successful! Your consultation is now paid.');
    if (payment === 'cancelled') toast.error('Payment was cancelled.');
  }, []);

  useEffect(() => {
    fetchConsultations();
    if (user?.role === 'reporter') {
      consultationsAPI.getAuthorities().then(({ data }) => setAuthorities(data.data?.authorities || [])).catch(() => {});
    }
  }, []);

  const fetchConsultations = async () => {
    setLoading(true);
    try {
      const { data } = await consultationsAPI.getAll();
      setConsultations(data.data?.consultations || []);
    } catch { toast.error('Failed to load consultations'); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!form.authority_id) { toast.error('Select an authority'); return; }
    setCreating(true);
    try {
      await consultationsAPI.create({ authority_id: form.authority_id, title: form.title || 'Consultation Request', description: form.description, scheduled_at: form.scheduled_at });
      toast.success('Consultation request sent!');
      setShowNewModal(false);
      setForm({ authority_id: '', description: '', scheduled_at: '', title: 'Consultation Request' });
      fetchConsultations();
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed'); }
    finally { setCreating(false); }
  };

  const handlePay = async (id) => {
    setPaying(id);
    try {
      const { data } = await consultationsAPI.pay(id);
      window.location.href = data.data.url;
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Payment setup failed');
      setPaying(null);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      await consultationsAPI.updateStatus(id, { status });
      setConsultations(p => p.map(c => c.id === id ? { ...c, status } : c));
      toast.success(`Consultation ${status.toLowerCase()}`);
    } catch { toast.error('Failed to update'); }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Consultations</h1>
            <p className="text-slate-400 text-sm mt-1">Schedule professional consultations with authorities</p>
          </div>
          {user?.role === 'reporter' && (
            <button onClick={() => setShowNewModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
              + New Consultation
            </button>
          )}
        </div>

        {loading ? (
          <div className="card p-8 text-center text-slate-400">Loading consultations...</div>
        ) : consultations.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-4xl mb-3">📅</div>
            <p className="text-slate-400">No consultations scheduled yet.</p>
            {user?.role === 'reporter' && (
              <button onClick={() => setShowNewModal(true)}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors">
                Schedule a consultation
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {consultations.map(c => (
              <div key={c.id} className="card p-5 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[c.status]}`}>
                      {c.status}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${c.payment_status === 'Paid' ? 'text-green-400' : 'text-yellow-400'}`}>
                      💳 {c.payment_status}
                    </span>
                  </div>
                  <p className="text-slate-200 font-medium">
                    {user?.role === 'reporter' ? `With: ${c.authority_name}` : `From: ${c.reporter_name}`}
                  </p>
                  {c.scheduled_at && (
                    <p className="text-sm text-slate-400 mt-1">📅 {format(new Date(c.scheduled_at), 'PPP p')}</p>
                  )}
                  {c.notes && <p className="text-sm text-slate-400 mt-1 italic">"{c.notes}"</p>}
                  {c.amount > 0 && <p className="text-sm text-slate-400 mt-1">💰 ৳{c.amount}</p>}
                </div>
                {user?.role === 'reporter' && (c.status === 'Confirmed' || c.status === 'Completed') && c.payment_status === 'Unpaid' && c.amount > 0 && (
                  <button
                    onClick={() => handlePay(c.id)}
                    disabled={paying === c.id}
                    className="px-4 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg shrink-0 transition-colors">
                    {paying === c.id ? 'Redirecting…' : 'Pay Now'}
                  </button>
                )}
                {user?.role === 'authority' && c.status === 'Pending' && (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => handleUpdateStatus(c.id, 'Confirmed')}
                      className="px-3 py-1.5 bg-green-700/40 hover:bg-green-700/60 text-green-400 text-xs rounded-lg font-medium">Confirm</button>
                    <button onClick={() => handleUpdateStatus(c.id, 'Cancelled')}
                      className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs rounded-lg font-medium">Cancel</button>
                  </div>
                )}
                {user?.role === 'authority' && c.status === 'Confirmed' && (
                  <button onClick={() => handleUpdateStatus(c.id, 'Completed')}
                    className="px-3 py-1.5 bg-blue-700/40 hover:bg-blue-700/60 text-blue-400 text-xs rounded-lg font-medium shrink-0">Mark Complete</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Consultation Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="card p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">Schedule Consultation</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Select Authority</label>
                <select value={form.authority_id} onChange={e => setForm(p => ({ ...p, authority_id: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm">
                  <option value="">Select an authority officer...</option>
                  {authorities.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} — {a.department_name}{a.consultation_fee > 0 ? ` (৳${Number(a.consultation_fee).toFixed(2)})` : ' (Free)'}
                    </option>
                  ))}
                </select>
                {/* Show fee callout when an authority is selected */}
                {form.authority_id && (() => {
                  const sel = authorities.find(a => String(a.id) === String(form.authority_id));
                  return sel ? (
                    <p className="mt-2 text-sm text-slate-400">
                      Consultation fee: <span className="text-white font-semibold">
                        {sel.consultation_fee > 0 ? `৳${Number(sel.consultation_fee).toFixed(2)}` : 'Free'}
                      </span>
                    </p>
                  ) : null;
                })()}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Preferred Date & Time</label>
                <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(p => ({ ...p, scheduled_at: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes / Purpose</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3}
                  placeholder="Briefly describe the purpose of this consultation..." name="description"
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowNewModal(false)}
                className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg">Cancel</button>
              <button onClick={handleCreate} disabled={creating}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg">
                {creating ? 'Sending...' : 'Request Consultation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
