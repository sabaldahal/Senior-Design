import axios from 'axios';

const CLASSIFY_BASE = import.meta.env.VITE_CLASSIFY_URL || '/api';

const classifyClient = axios.create({
  baseURL: CLASSIFY_BASE,
  timeout: 30000,
});

classifyClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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
