import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/UnifiedAuthContext';

interface PrivateRouteProps {
  redirectTo?: string;
}

export const PrivateRoute = ({ redirectTo = '/login' }: PrivateRouteProps) => {
  const { user, isLoaded  } = useAuth();

  // 如果正在加载，显示加载状态或返回null
  if (!isLoaded) {
    return null; // 或者返回加载指示器
  }

  // 未登录，重定向到登录页面
  if (!user) {
    return <Navigate to={redirectTo} replace />;
  }

  // 如果已登录，渲染子路由
  return <Outlet />;
};

export const PublicRoute = () => {
  const { user, isLoaded, isSignedIn } = useAuth();

  // 如果正在加载，显示加载状态或返回null
  if (!isLoaded) {
    return null; // 或者返回加载指示器
  }

  // 如果已登录，重定向到项目页面
  if (isSignedIn && user) {
    // return <Navigate to="/project" replace />;
  }

  // 如果未登录，渲染子路由
  return <Outlet />;
}; 