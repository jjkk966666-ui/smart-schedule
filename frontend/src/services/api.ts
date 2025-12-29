import axios from 'axios';

// 智能获取API基础URL
// 优先使用环境变量配置，否则自动检测环境
const getApiBaseUrl = (): string => {
  // 如果设置了环境变量且不是默认的 localhost 值，使用环境变量
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && !envUrl.includes('localhost:3000')) {
    return envUrl;
  }
  
  // 检测当前是否在 devtunnels 环境中
  const currentHost = window.location.hostname;
  const currentOrigin = window.location.origin;
  
  // VS Code devtunnels 环境：自动将前端端口替换为后端端口
  if (currentHost.includes('.devtunnels.ms')) {
    // 例如：https://dxnmlm94-5173.usw2.devtunnels.ms -> https://dxnmlm94-3000.usw2.devtunnels.ms
    const backendUrl = currentOrigin.replace('-5173.', '-3000.').replace('-4173.', '-3000.');
    console.log('Detected devtunnels environment, API URL:', backendUrl + '/api');
    return backendUrl + '/api';
  }
  
  // GitHub Codespaces 环境
  if (currentHost.includes('.github.dev')) {
    const backendUrl = currentOrigin.replace('-5173.', '-3000.').replace('-4173.', '-3000.');
    console.log('Detected GitHub Codespaces environment, API URL:', backendUrl + '/api');
    return backendUrl + '/api';
  }
  
  // 本地开发环境
  if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
    return 'http://localhost:3000/api';
  }
  
  // 其他情况：使用相对路径
  return '/api';
};

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加认证令牌
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器 - 处理错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;