import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
});

export function friendlyApiError(error) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (error?.code === 'ECONNABORTED') return 'The server took too long to respond.';
  if (!error?.response) return 'Unable to reach the backend. Make sure FastAPI is running.';
  return 'Something went wrong. Please try again.';
}
