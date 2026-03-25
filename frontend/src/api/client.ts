import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const client = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    'Accept': 'application/json',
  },
});

client.interceptors.request.use((config) => {
  config.headers['ngrok-skip-browser-warning'] = 'true';

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
  (res) => {
    const ct = res.headers['content-type'] || '';
    if (ct.includes('text/html') && typeof res.data === 'string' && res.data.includes('ngrok')) {
      return Promise.reject(new Error('Ngrok warning page received. Please retry.'));
    }
    return res;
  },
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
