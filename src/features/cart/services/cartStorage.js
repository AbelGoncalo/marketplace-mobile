import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CART_KEY = 'ponto-certo-guest-cart';

/** Recupera a credencial do carrinho visitante sem a misturar com o JWT da conta. */
export async function getGuestCartToken() {
  return Platform.OS === 'web'
    ? globalThis.localStorage?.getItem(CART_KEY) || null
    : SecureStore.getItemAsync(CART_KEY);
}

/** Guarda apenas o token opaco; preços e produtos continuam sob controlo da API. */
export async function saveGuestCartToken(token) {
  if (Platform.OS === 'web') globalThis.localStorage?.setItem(CART_KEY, token);
  else await SecureStore.setItemAsync(CART_KEY, token);
}

/** Elimina a credencial visitante depois da fusão ou expiração confirmada. */
export async function removeGuestCartToken() {
  if (Platform.OS === 'web') globalThis.localStorage?.removeItem(CART_KEY);
  else await SecureStore.deleteItemAsync(CART_KEY);
}
