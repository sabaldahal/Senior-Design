import axios from 'axios';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  if (auth?.currentUser) {
    const token = await auth.currentUser.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    const legacy = localStorage.getItem('authToken');
    if (legacy) {
      config.headers.Authorization = `Bearer ${legacy}`;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      if (auth?.currentUser) {
        try {
          await signOut(auth);
        } catch {
          // ignore
        }
      }
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default apiClient;
