import { useEffect, useState } from 'react';

export function useAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get token from localStorage
    const storedToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    setToken(storedToken);
    setLoading(false);
  }, []);

  return {
    token,
    loading,
    isAuthenticated: !!token,
  };
}
