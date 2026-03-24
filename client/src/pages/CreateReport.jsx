import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import LocationPicker from '../components/LocationPicker';
import { categoriesAPI, reportsAPI } from '../services/api';
import toast from 'react-hot-toast';
import 'leaflet/dist/leaflet.css';

export default function CreateReport() {
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState([]);

  const [form, setForm] = useState({
    title: '',
    description: '',
    category_id: '',
    is_anonymous: false,
    location_text: '',
    location_lat: '',
    location_lng: '',
    incident_date: '',
    incident_time: '',
  });

  const [isDraft, setIsDraft] = useState(false);

  useEffect(() => {
    categoriesAPI
      .getAll()
      .then(({ data }) => setCategories(data.data?.categories || []))
      .catch(() => toast.error('Failed to load categories'))
      .finally(() => setLoadingCategories(false));
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleFileChange = (e) => {
    const picked = Array.from(e.target.files || []);
    if (files.length + picked.length > 5) {
      toast.error('Maximum 5 files allowed');
      return;
    }
    setFiles((prev) => [...prev, ...picked]);
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    saveReport(false);
  };

  const saveDraft = async () => {
    saveReport(true);
  };

  const saveReport = async (asDraft) => {
    if (!asDraft && (!form.title || !form.description || !form.category_id)) {
      toast.error('Title, description, and category are required');
      return;
    }

    setSubmitting(true);

    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('description', form.description);
      fd.append('category_id', form.category_id);
      fd.append('is_anonymous', form.is_anonymous ? 'true' : 'false');
      fd.append('is_draft', asDraft ? 'true' : 'false');

      // Combine date + time (if provided) into a single timestamp string
      if (form.incident_date) {
        const ts = form.incident_time
          ? `${form.incident_date}T${form.incident_time}`
          : form.incident_date;
        fd.append('incident_date', ts);
      }

      if (form.location_text) fd.append('location_text', form.location_text);
      if (form.location_lat !== '') fd.append('location_lat', form.location_lat);
      if (form.location_lng !== '') fd.append('location_lng', form.location_lng);

      files.forEach((file) => fd.append('evidence', file));

      const { data } = await reportsAPI.create(fd);
      const report = data.data.report;

      if (asDraft) {
        toast.success('Draft saved successfully');
        navigate('/dashboard');
      } else {
        toast.success(`Report submitted. Tracking ID: ${report.tracking_id}`);
        navigate(`/reports/${report.id}`);
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 py-8 page-enter">
        <h1 className="text-2xl font-semibold text-slate-100 mb-2">Create Incident Report</h1>
        <p className="text-slate-400 text-sm mb-6">Provide the necessary details to file your report.</p>

        <form onSubmit={handleSubmit} className="card p-6 space-y-5">
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Report Title *</label>
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              maxLength={200}
              className="input-field"
              placeholder="Brief title of the incident"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Category *</label>
            <select
              name="category_id"
              value={form.category_id}
              onChange={handleChange}
              className="input-field"
              required
              disabled={loadingCategories}
            >
              <option value="">{loadingCategories ? 'Loading categories...' : 'Select category...'}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Detailed Description *</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={6}
              className="input-field resize-none"
              placeholder="Describe what happened in detail"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Incident Date & Time</label>
            <div className="flex gap-3">
              <input
                name="incident_date"
                type="date"
                value={form.incident_date}
                onChange={handleChange}
                className="input-field flex-1"
              />
              <input
                name="incident_time"
                type="time"
                value={form.incident_time}
                onChange={handleChange}
                className="input-field flex-1"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              name="is_anonymous"
              checked={form.is_anonymous}
              onChange={handleChange}
            />
            Submit anonymously (authority will not see your identity)
          </label>

          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Incident Location (optional)</label>
            <LocationPicker
              lat={form.location_lat}
              lng={form.location_lng}
              locationText={form.location_text}
              onChange={({ location_lat, location_lng, location_text }) =>
                setForm((prev) => ({ ...prev, location_lat, location_lng, location_text }))
              }
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Evidence Files (optional)</label>
            <p className="text-xs text-slate-500 mb-2">Images, PDF, or video. Max 5 files, 50MB each.</p>
            <input
              type="file"
              multiple
              accept="image/*,.pdf,video/*"
              onChange={handleFileChange}
              className="input-field"
            />

            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((file, idx) => (
                  <div key={`${file.name}-${idx}`} className="flex items-center justify-between bg-white/[0.03] border border-white/[0.08] rounded p-2">
                    <div>
                      <p className="text-sm text-slate-200">{file.name}</p>
                      <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="text-xs px-2 py-1 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={saveDraft} disabled={submitting} className="btn-secondary text-sm disabled:opacity-50">
              {submitting ? 'Saving...' : 'Save as Draft'}
            </button>
            <button type="submit" disabled={submitting} className="btn-primary text-sm disabled:opacity-50">
              {submitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
