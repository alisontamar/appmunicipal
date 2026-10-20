import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

import * as authApi from '@/api/auth';
import { cargarTokens, SesionExpiradaError } from '@/api/client';
import { detenerWidget, limpiarSesionWidget } from '@/native/overlay';
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

// Copia local del guardia: permite abrir la app al instante sin esperar a la red.
const GUARDIA_KEY = 'gamc:guardia';

async function guardarGuardia(g: Guardia | null): Promise<void> {
  try {
    if (g) await AsyncStorage.setItem(GUARDIA_KEY, JSON.stringify(g));
    else await AsyncStorage.removeItem(GUARDIA_KEY);
  } catch {
    // best effort
  }
}

async function leerGuardia(): Promise<Guardia | null> {
  try {
    const raw = await AsyncStorage.getItem(GUARDIA_KEY);
    return raw ? (JSON.parse(raw) as Guardia) : null;
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [guardia, setGuardia] = useState<Guardia | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ultimoUsuario, setUltimoUsuario] = useState<string | null>(null);

  // Al arrancar: si hay token y un guardia guardado, se entra al instante y la
  // sesion se valida contra /me en segundo plano. Antes se esperaba a /me con la
  // pantalla en blanco: con red lenta (o sin respuesta) la app quedaba negra.
  useEffect(() => {
    let vigente = true;
    (async () => {
      let validar = false;
      try {
        const { accessToken } = await cargarTokens();
        if (accessToken) {
          const guardado = await leerGuardia();
          if (guardado && vigente) {
            setGuardia(guardado);
            setToken(accessToken);
            setUltimoUsuario(guardado.usuario);
            validar = true;
          } else {
            // Primera vez tras actualizar: no hay copia local, se espera a /me.
            const g = await authApi.me();
            if (!vigente) return;
            setGuardia(g);
            setToken(accessToken);
            setUltimoUsuario(g.usuario);
            void guardarGuardia(g);
          }
        }
      } catch {
        // Token vencido o invalidado: se arranca en la pantalla de login.
      } finally {
        if (vigente) setBooting(false);
      }

      if (!validar) return;
      try {
        const g = await authApi.me();
        if (!vigente) return;
        setGuardia(g);
        void guardarGuardia(g);
      } catch (e) {
        // Sin red: se queda con la sesion local. Solo se cierra si el servidor la rechaza.
        if (vigente && e instanceof SesionExpiradaError) {
          setToken(null);
          setGuardia(null);
          void guardarGuardia(null);
        }
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
      void guardarGuardia(res.guardia);
      setUltimoUsuario(usuario);
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(() => {
    // Sin sesión no debe quedar el widget sobre otras apps ni su copia de sesión.
    detenerWidget();
    limpiarSesionWidget();
    setToken(null);
    setGuardia(null);
    void guardarGuardia(null);
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
