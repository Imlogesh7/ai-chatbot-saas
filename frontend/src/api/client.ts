import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const client = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

client.interceptors.request.use((config) => {
  const raw = localStorage.getItem('auth-storage');
  if (raw) {
    try {
      const { state } = JSON.parse(raw);
      if (state?.token) {
        config.headers.Authorization = `Bearer ${state.token}`;
      }
    } catch { /* ignore */ }
  }
  return config;
});

let isLoggingOut = false;

client.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && !isLoggingOut) {
      isLoggingOut = true;
      localStorage.removeItem('auth-storage');
      window.location.href = '/login';
      setTimeout(() => { isLoggingOut = false; }, 3000);
    }
    return Promise.reject(error);
  },
);

export default client;
