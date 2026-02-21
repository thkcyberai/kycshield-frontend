import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const AuthContext = createContext(null);

const API_BASE = 'https://api.kycshield.ai';

export const AuthProvider = ({ children }) => {
  const [accessToken, setAccessToken] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const login = (token) => {
    setAccessToken(token);
  };

  const logout = () => {
    setAccessToken(null);
  };

  // Restore session on page load using HttpOnly refresh cookie
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const res = await fetch(API_BASE + '/api/v1/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!res.ok) {
          // Not logged in or refresh expired
          if (!cancelled) setAccessToken(null);
          return;
        }

        const data = await res.json();
        if (!cancelled && data && data.access_token) {
          setAccessToken(data.access_token);
        }
      } catch {
        if (!cancelled) setAccessToken(null);
      } finally {
        if (!cancelled) setIsBootstrapping(false);
      }
    };

    bootstrap();
    return () => { cancelled = true; };
  }, []);

  const value = useMemo(() => ({
    accessToken,
    isBootstrapping,
    login,
    logout
  }), [accessToken, isBootstrapping]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
