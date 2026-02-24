import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AuthAPI } from '@/lib/api';

export interface User {
  id: string;
  username: string;
  email?: string;
  name?: string;
  avatar?: string;
  currentProjectId?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthContextType {
  user: User | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (username: string, password: string, nickname?: string) => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
  token?: string;
}

const UnifiedAuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(UnifiedAuthContext);
  if (!context) {
    throw new Error('useAuth must be used within UnifiedAuthProvider');
  }
  return context;
};

interface UnifiedAuthProviderProps {
  children: ReactNode;
}

export const UnifiedAuthProvider: React.FC<UnifiedAuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('access_token')
  );

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          const userData = await AuthAPI.getCurrentUser();
          setUser(userData);
        } catch (error) {
          console.error('Failed to load user:', error);
          setToken(null);
          localStorage.removeItem('access_token');
        }
      }
      setIsLoaded(true);
    };

    initAuth();
  }, [token]);

  const login = async (username: string, password: string) => {
    const formData = new FormData();
    formData.append("username", username);
    formData.append("password", password);
    const response = await AuthAPI.login(formData);
    const loginData = response.data;
    setToken(loginData.access_token);
    setUser(loginData.user);
    localStorage.setItem('access_token', loginData.access_token);
  };

  const logout = async () => {
    try {
      await AuthAPI.logout();
    } finally {
      setToken(null);
      setUser(null);
      localStorage.removeItem('access_token');
    }
  };

  const register = async (username: string, password: string, nickname?: string) => {
    await AuthAPI.register({ username, password, nickname });
  };

  const updateUser = async (userData: Partial<User>) => {
    if (!user) return;
    const updatedUser = await AuthAPI.updateUser(userData);
    setUser(updatedUser);
  };

  const value: AuthContextType = {
    user,
    isLoaded,
    isSignedIn: !!user,
    login,
    logout,
    register,
    updateUser,
    token: token || undefined,
  };

  return (
    <UnifiedAuthContext.Provider value={value}>
      {children}
    </UnifiedAuthContext.Provider>
  );
};
