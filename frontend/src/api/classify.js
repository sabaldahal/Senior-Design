import axios from 'axios';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

const CLASSIFY_BASE = import.meta.env.VITE_CLASSIFY_URL || '/api';

const classifyClient = axios.create({
  baseURL: CLASSIFY_BASE,
  timeout: 30000,
});

classifyClient.interceptors.request.use(async (config) => {
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

classifyClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
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

export const classifyApi = {
  /**
   * Send a captured camera frame to the ML classification Lambda.
   * @param {Blob} imageBlob - PNG/JPEG blob from canvas capture
   * @returns {Promise<{data: {label: string, confidence: number, category: string}}>}
   */
  classifyImage: (imageBlob) => {
    const formData = new FormData();
    formData.append('image', imageBlob, 'capture.png');
    return classifyClient.post('/classify-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
