import apiClient from './client';

export const authApi = {
  login: (username, password) =>
    apiClient.post('/auth/login', { username, password }),
  logout: () => apiClient.post('/auth/logout'),
};

export const inventoryApi = {
  getItems: () => apiClient.get('/inventory/items'),
  getItem: (id) => apiClient.get(`/inventory/items/${id}`),
  addItem: (data) => apiClient.post('/inventory/items', data),
  updateItem: (id, data) => apiClient.put(`/inventory/items/${id}`, data),
  deleteItem: (id) => apiClient.delete(`/inventory/items/${id}`),
  uploadImage: (formData) =>
    apiClient.post('/inventory/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  /** Store a raw camera capture for later model processing */
  uploadCapture: (formData) =>
    apiClient.post('/inventory/captures', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getCaptures: () => apiClient.get('/inventory/captures'),
  /** Apply ML inference output: create row or patch existing (itemId). See backend POST /api/inventory/inference */
  applyInference: (payload) => apiClient.post('/inventory/inference', payload),
};

export const dashboardApi = {
  getSummary: () => apiClient.get('/dashboard/summary'),
  getAlerts: () => apiClient.get('/alerts'),
  /** Runs low-stock email job (same as cron). Requires SMTP + ALERT_EMAIL_TO on server. */
  sendLowStockEmail: () => apiClient.post('/alerts/send-low-stock-email'),
};
