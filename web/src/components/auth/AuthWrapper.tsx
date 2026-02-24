import React, { type ReactNode } from 'react';
import { UnifiedAuthProvider } from '@/contexts/UnifiedAuthContext';

interface AuthWrapperProps {
  children: ReactNode;
}

export const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
  return (
    <UnifiedAuthProvider>
      {children}
    </UnifiedAuthProvider>
  );
};
