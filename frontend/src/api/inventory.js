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
};

export const dashboardApi = {
  getSummary: () => apiClient.get('/dashboard/summary'),
  getAlerts: () => apiClient.get('/alerts'),
};
