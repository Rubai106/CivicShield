import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('cs_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('cs_token');
      localStorage.removeItem('cs_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
  onboardAuthority: (data) => api.post('/auth/onboard-authority', data),
  getOnboardingStatus: () => api.get('/auth/onboarding-status'),
};

export const reportsAPI = {
  getAll: (params) => api.get('/reports', { params }),
  getById: (id) => api.get(`/reports/${id}`),
  create: (data) => api.post('/reports', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, data) => api.put(`/reports/${id}`, data, {
    headers: { 'Content-Type': data instanceof FormData ? 'multipart/form-data' : 'application/json' },
  }),
  updateStatus: (id, data) => api.patch(`/reports/${id}/status`, data),
  reassign: (id, data) => api.patch(`/reports/${id}/reassign`, data),
  delete: (id) => api.delete(`/reports/${id}`),
};

export const categoriesAPI = {
  getAll: (params) => api.get('/categories', { params }),
  getById: (id) => api.get(`/categories/${id}`),
};

export const departmentsAPI = {
  getAll: () => api.get('/departments'),
};

export const notificationsAPI = {
  getAll: (params) => api.get('/notifications', { params }),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  getUnreadCount: () => api.get('/notifications'),
};

export const adminAPI = {
  // Stats & analytics
  getAnalytics: () => api.get('/admin/stats'),
  getMonthlyTrend: (params) => api.get('/admin/monthly-trend', { params }),

  // Users
  getUsers: (params) => api.get('/admin/users', { params }),
  verifyAuthority: (userId, data) => api.put(`/admin/users/${userId}/verify-authority`, data),

  // Authority review requests
  getAuthorityRequests: (params) => api.get('/admin/authority-requests', { params }),
  approveAuthority: (id) => api.post(`/admin/authority-requests/${id}/approve`),
  rejectAuthority: (id, data) => api.post(`/admin/authority-requests/${id}/reject`, data),
  requestMoreInfo: (id, data) => api.post(`/admin/authority-requests/${id}/request-info`, data),

  // Categories
  createCategory: (data) => api.post('/categories', data),
  updateCategory: (id, data) => api.put(`/categories/${id}`, data),
  deleteCategory: (id) => api.delete(`/categories/${id}`),

  // Routing rules
  getMappings: () => api.get('/admin/routing-rules'),
  createMapping: (data) => api.post('/admin/routing-rules', data),
  deleteMapping: (id) => api.delete(`/admin/routing-rules/${id}`),

  // SLA
  getSLARules: () => api.get('/admin/sla-rules'),
  setSLARule: (data) => api.post('/admin/sla-rules', data),
  getComplianceDashboard: () => api.get('/admin/sla-monitoring'),

  // Audit logs
  getAuditLogs: () => api.get('/admin/audit-logs'),
};

export const commentsAPI = {
  getForReport: (reportId) => api.get(`/comments/${reportId}`),
  create: (reportId, data) => api.post(`/comments/${reportId}`, data),
  delete: (commentId) => api.delete(`/comments/${commentId}`),
};

export const reopenAPI = {
  request: (reportId, data) => api.post(`/reports/${reportId}/reopen`, data),
  decide: (reportId, requestId, data) => api.put(`/reports/${reportId}/reopen/${requestId}`, data),
};

export const chatAPI = {
  getContacts: () => api.get('/chat/contacts'),
  getConversation: (userId) => api.get(`/chat/conversation/${userId}`),
  getUser: (userId) => api.get(`/chat/user/${userId}`),
  sendMessage: (userId, data) => api.post(`/chat/message/${userId}`, data),
};

export default api;
