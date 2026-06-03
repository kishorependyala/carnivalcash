import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001',
  timeout: 60000, // 60s — allows for Azure Free tier cold-start wake-up
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    // Pre-flight expiry check — catches expired tokens before wasting a network round-trip
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.dispatchEvent(new Event('auth:logout'));
        return Promise.reject(new Error('Token expired'));
      }
    } catch (_) {
      // Malformed token — let the 401 handler deal with it
    }
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401 so stale sessions don't silently fail
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('auth:logout'));
    }
    return Promise.reject(error);
  }
);

export default api;
