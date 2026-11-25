import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** Isola a tentativa por conta; o JWT nunca é guardado neste registo. */
function storageKey(userId) {
  return `ponto-certo-checkout-${userId}`;
}

/** Recupera uma tentativa para retomar uma confirmação mesmo após reiniciar o Expo. */
export async function getCheckoutAttempt(userId) {
  const key = storageKey(userId);
  const value =
    Platform.OS === 'web'
      ? globalThis.localStorage?.getItem(key)
      : await SecureStore.getItemAsync(key);
  return value ? JSON.parse(value) : null;
}

/** Persiste antes de enviar pedidos para preservar a chave em caso de falha de rede. */
export async function saveCheckoutAttempt(userId, attempt) {
  const key = storageKey(userId);
  const value = JSON.stringify(attempt);
  if (Platform.OS === 'web') globalThis.localStorage.setItem(key, value);
  else await SecureStore.setItemAsync(key, value);
}

/** Descarta apenas uma tentativa que o utilizador decidiu abandonar ou já reconheceu. */
export async function removeCheckoutAttempt(userId) {
  const key = storageKey(userId);
  if (Platform.OS === 'web') globalThis.localStorage?.removeItem(key);
  else await SecureStore.deleteItemAsync(key);
}
