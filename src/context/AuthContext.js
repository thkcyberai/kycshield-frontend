import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

const AuthContext = createContext(null);

const API_BASE = 'https://api.kycshield.ai';
const yieldToBrowser = () => new Promise((resolve) => setTimeout(resolve, 0));

export const AuthProvider = ({ children }) => {
  const [accessToken, setAccessToken] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const hasBootstrapped = useRef(false);
  const refreshInFlight = useRef(null);

  const login = (token) => {
    setAccessToken(token);
  };

  const logout = () => {
    setAccessToken(null);
  };

  useEffect(() => {
    if (hasBootstrapped.current) return;
    hasBootstrapped.current = true;

    let cancelled = false;

    const refreshOnce = async () => {
      return fetch(API_BASE + '/api/v1/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const bootstrap = async () => {
      try {
        // If we already have a token (fresh login), don't refresh.
        if (accessToken) return;

        if (refreshInFlight.current) {
          await refreshInFlight.current;
          return;
        }

        refreshInFlight.current = (async () => {
          // Yield so cookie jar commits before first refresh attempt.
          await yieldToBrowser();

          let res = await refreshOnce();

          // Race safety: first refresh can 401 before cookie is attached.
          if (!res.ok && res.status === 401) {
            await yieldToBrowser();
            res = await refreshOnce();
          }

          if (!res.ok) {
            if (!cancelled) setAccessToken(null);
            return;
          }

          const data = await res.json();
          if (!cancelled && data && data.access_token) {
            setAccessToken(data.access_token);
          }
        })();

        await refreshInFlight.current;
      } catch {
        if (!cancelled) setAccessToken(null);
      } finally {
        refreshInFlight.current = null;
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
