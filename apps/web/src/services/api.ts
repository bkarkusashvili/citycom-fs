import axios from 'axios';
import type { AuthResponse, FsNode } from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

// Auth API
export const authApi = {
  register: async (email: string, password: string): Promise<AuthResponse> => {
    const { data } = await api.post('/auth/register', { email, password });
    return data;
  },

  login: async (email: string, password: string): Promise<AuthResponse> => {
    const { data } = await api.post('/auth/login', { email, password });
    return data;
  },
};

// Filesystem API
export const fsApi = {
  listDirectory: async (path: string = '/'): Promise<FsNode[]> => {
    const { data } = await api.get('/fs/list', { params: { path } });
    return data;
  },

  createDirectory: async (path: string): Promise<FsNode> => {
    const { data } = await api.post('/fs/directory', { path });
    return data;
  },

  deleteDirectory: async (path: string): Promise<void> => {
    await api.delete('/fs/directory', { params: { path } });
  },

  uploadFile: async (path: string, file: File): Promise<FsNode> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path);
    const { data } = await api.post('/fs/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  downloadFile: async (path: string): Promise<Blob> => {
    const { data } = await api.get('/fs/download', {
      params: { path },
      responseType: 'blob',
    });
    return data;
  },

  readFile: async (path: string): Promise<string> => {
    const { data } = await api.get('/fs/file', { params: { path } });
    return data.content;
  },

  deleteFile: async (path: string): Promise<void> => {
    await api.delete('/fs/file', { params: { path } });
  },

  copyFile: async (from: string, to: string): Promise<FsNode> => {
    const { data } = await api.post('/fs/file/copy', { from, to });
    return data;
  },

  moveFile: async (from: string, to: string): Promise<FsNode> => {
    const { data } = await api.post('/fs/file/move', { from, to });
    return data;
  },

  getInfo: async (path: string): Promise<FsNode> => {
    const { data } = await api.get('/fs/info', { params: { path } });
    return data;
  },
};

export default api;
