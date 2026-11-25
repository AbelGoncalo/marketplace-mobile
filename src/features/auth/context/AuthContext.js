import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  getStoredSession,
  removeStoredSession,
  saveSession,
} from '@/services/storage/sessionStorage';
import { onUnauthorized } from '@/services/http/apiClient';
import {
  createSession,
  getCurrentAccess,
  login,
  logout,
  register,
} from '@/features/auth/services/authApi';

const AuthContext = createContext(null);

/**
 * Disponibiliza a sessão para toda a árvore da aplicação.
 * Login e cadastro comunicam com a API e persistem apenas a sessão devolvida.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const currentSession = useRef(null);
  const [sessionError, setSessionError] = useState('');
  const [restoreAttempt, setRestoreAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      try {
        const stored = await getStoredSession();
        if (!stored) return;
        const access = await getCurrentAccess(stored.token);
        const restored = createSession({ access, access_token: stored.token });
        await saveSession(restored);
        if (active) {
          currentSession.current = restored;
          setSession(restored);
          setSessionError('');
        }
      } catch (error) {
        if (error.status === 401) {
          await removeStoredSession().catch(() => {});
        } else if (active) {
          setSessionError(
            'Não foi possível validar a sessão. Verifique a ligação e tente novamente.',
          );
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }
    restoreSession();
    const unsubscribe = onUnauthorized((token) => {
      if (!active || currentSession.current?.token !== token) return;
      currentSession.current = null;
      setSession(null);
      removeStoredSession().catch(() => {});
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [restoreAttempt]);

  function retrySession() {
    setIsLoading(true);
    setSessionError('');
    setRestoreAttempt((value) => value + 1);
  }

  async function signIn(credentials) {
    const nextSession = createSession(await login(credentials));
    await saveSession(nextSession);
    currentSession.current = nextSession;
    setSession(nextSession);
    return nextSession;
  }

  async function signUp(payload) {
    const nextSession = createSession(await register(payload));
    await saveSession(nextSession);
    currentSession.current = nextSession;
    setSession(nextSession);
    return nextSession;
  }

  /** Reconsulta a identidade completa e preserva o token e as permissões após editar o perfil. */
  async function refreshProfile(token) {
    const access = await getCurrentAccess(token);
    if (currentSession.current?.token !== token) return;
    const updated = createSession({ access, access_token: token });
    await saveSession(updated);
    if (currentSession.current?.token !== token) return;
    currentSession.current = updated;
    setSession(updated);
  }

  /** Descarta localmente o token invalidado pela alteração da palavra-passe, sem novo pedido HTTP. */
  async function clearSession(token) {
    if (currentSession.current?.token !== token) return;
    await removeStoredSession();
    if (currentSession.current?.token !== token) return;
    currentSession.current = null;
    setSession(null);
    setSessionError('');
  }

  async function signOut() {
    const token = currentSession.current?.token;
    try {
      if (token) await logout(token);
    } catch (error) {
      // Um token já expirado equivale a uma sessão encerrada no servidor.
      if (error.status !== 401) throw error;
    }
    await removeStoredSession();
    currentSession.current = null;
    setSession(null);
    setSessionError('');
  }

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(session?.token),
      isLoading,
      session,
      sessionError,
      retrySession,
      signIn,
      signOut,
      signUp,
      refreshProfile,
      clearSession,
    }),
    [isLoading, session, sessionError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Garante que o hook seja usado apenas abaixo do AuthProvider. */
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  }

  return context;
}
