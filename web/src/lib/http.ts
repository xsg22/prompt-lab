import axios from 'axios';
import { message } from 'antd';

// 获取环境变量
const serverHost = process.env.VITE_SERVER_HOST

const instance = axios.create({
  baseURL: serverHost, // 默认 host
  timeout: 60000,
  withCredentials: true,
})

// 响应拦截器（处理 401）
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    const { response, config } = error;
    const isInvitePage = window.location.pathname.includes('/invite/');
    const isLandingPage = window.location.pathname.includes('/');
    if (response?.status === 401 && !config.url.includes('/auth/login') && !isInvitePage && !isLandingPage) {
      message.warning('需要登录，请先登录！', 3);
    }
    return Promise.reject(error);
  }
);

export default instance;