import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const AuthContext = createContext(null);

function decodeToken(token) {
  if (!token) {
    return null;
  }

  try {
    const payload = token.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
    return JSON.parse(json);
  } catch (error) {
    return null;
  }
}

function getStoredAuth() {
  const token = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');
  const decoded = decodeToken(token);

  if (!token || !decoded) {
    return { token: null, user: null };
  }

  return {
    token,
    user: {
      ...(storedUser ? JSON.parse(storedUser) : {}),
      ...decoded,
    },
  };
}

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState(() => getStoredAuth());

  useEffect(() => {
    const nextState = getStoredAuth();
    if (!nextState.token && (authState.token || authState.user)) {
      setAuthState(nextState);
    }
  }, [authState.token, authState.user]);

  const value = useMemo(
    () => ({
      user: authState.user,
      token: authState.token,
      login: (token, userData) => {
        const decoded = decodeToken(token) || {};
        const mergedUser = { ...decoded, ...(userData || {}) };
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(mergedUser));
        setAuthState({ token, user: mergedUser });
      },
      logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setAuthState({ token: null, user: null });
      },
    }),
    [authState]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
