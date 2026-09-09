import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import * as authApi from '@/api/auth';
import { cargarTokens } from '@/api/client';
import type { Guardia } from '@/types';

interface AuthState {
  loading: boolean;
  // true mientras se intenta rehidratar la sesion guardada al abrir la app.
  booting: boolean;
  guardia: Guardia | null;
  token: string | null;
  isAuthenticated: boolean;
  // Se guarda tras el primer login manual; habilita el acceso con huella la proxima vez.
  ultimoUsuario: string | null;
  signIn: (usuario: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [guardia, setGuardia] = useState<Guardia | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ultimoUsuario, setUltimoUsuario] = useState<string | null>(null);

  // Al arrancar: si hay un token guardado, se valida contra /me y se entra directo.
  useEffect(() => {
    let vigente = true;
    (async () => {
      try {
        const { accessToken } = await cargarTokens();
        if (accessToken) {
          const g = await authApi.me();
          if (!vigente) return;
          setGuardia(g);
          setToken(accessToken);
          setUltimoUsuario(g.usuario);
        }
      } catch {
        // Token vencido o invalidado: se arranca en la pantalla de login.
      } finally {
        if (vigente) setBooting(false);
      }
    })();
    return () => {
      vigente = false;
    };
  }, []);

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
    void authApi.logout();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      booting,
      guardia,
      token,
      isAuthenticated: Boolean(token),
      ultimoUsuario,
      signIn,
      signOut,
    }),
    [loading, booting, guardia, token, ultimoUsuario, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
