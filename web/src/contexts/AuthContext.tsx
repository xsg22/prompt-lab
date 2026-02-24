import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { message } from "antd";
import { AuthAPI, UserAPI } from "../lib/api";

interface User {
  id: number;
  email: string;
  nickname: string | null;
  currentProjectId: number | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, verificationCode: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // 初始化时检查用户是否已登录
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await UserAPI.getCurrentUser();
        setUser(response.data);
      } catch (error) {
        console.log("User not authenticated");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // 登录
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      // 构建表单数据
      const formData = new FormData();
      formData.append("username", email);
      formData.append("password", password);

      // 发送登录请求
      await AuthAPI.login(formData);
      
      // 获取用户信息
      const userResponse = await UserAPI.getCurrentUser();
      setUser(userResponse.data);
      
      return userResponse.data;
    } catch (error: any) {
      console.error("Login failed:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // 登出
  const logout = async () => {
    try {
      await AuthAPI.logout();
      setUser(null);
      message.success("登出成功");
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
      message.error("登出失败");
    }
  };

  // 注册
  const register = async (
    email: string, 
    password: string, 
    verificationCode: string
  ) => {
    setIsLoading(true);
    try {
      const response = await AuthAPI.register({
        email,
        password,
        verification_code: verificationCode,
      });
      
      return response;
    } catch (error: any) {
      console.error("Registration failed:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    register,
  };

  return (
    <AuthContext.Provider
     value={value as unknown as AuthContextType}
     >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
} 