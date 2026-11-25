import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SESSION_KEY = 'ponto-certo-session';

/**
 * Lê a sessão persistida. No dispositivo usamos armazenamento criptografado;
 * no navegador, localStorage funciona como alternativa de desenvolvimento.
 */
export async function getStoredSession() {
  const value =
    Platform.OS === 'web'
      ? globalThis.localStorage?.getItem(SESSION_KEY)
      : await SecureStore.getItemAsync(SESSION_KEY);

  if (!value) return null;
  try {
    const session = JSON.parse(value);
    if (typeof session?.token === 'string' && session.token.trim() && session.user?.id) {
      return session;
    }
  } catch {
    // Uma sessão danificada deve permitir iniciar sessão novamente.
  }
  await removeStoredSession();
  return null;
}

/** Persiste token e utilizador entre reinicializações da aplicação. */
export async function saveSession(session) {
  const value = JSON.stringify(session);

  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(SESSION_KEY, value);
    return;
  }

  await SecureStore.setItemAsync(SESSION_KEY, value);
}

/** Remove completamente a sessão durante o logout. */
export async function removeStoredSession() {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(SESSION_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(SESSION_KEY);
}
