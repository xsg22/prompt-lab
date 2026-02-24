export interface AuthConfig {
  apiBaseUrl: string;
  tokenExpiry: number;
}

const getAuthConfig = (): AuthConfig => {
  return {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
    tokenExpiry: parseInt(import.meta.env.VITE_TOKEN_EXPIRY || '1800000'),
  };
};

export const authConfig = getAuthConfig();
