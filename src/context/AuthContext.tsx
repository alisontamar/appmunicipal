import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import * as authApi from '@/api/auth';
import type { Guardia } from '@/types';

interface AuthState {
  loading: boolean;
  guardia: Guardia | null;
  token: string | null;
  isAuthenticated: boolean;
  // Se guarda tras el primer login manual; habilita el acceso con huella la próxima vez.
  ultimoUsuario: string | null;
  signIn: (usuario: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(false);
  const [guardia, setGuardia] = useState<Guardia | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ultimoUsuario, setUltimoUsuario] = useState<string | null>(null);

  const signIn = useCallback(async (usuario: string, password: string) => {
    setLoading(true);
    try {
      const res = await authApi.login(usuario, password);
      setToken(res.token);
      setGuardia(res.guardia);
      setUltimoUsuario(usuario);
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
    setGuardia(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      guardia,
      token,
      isAuthenticated: Boolean(token),
      ultimoUsuario,
      signIn,
      signOut,
    }),
    [loading, guardia, token, ultimoUsuario, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}