const DEFAULT_API_URL = 'http://localhost:8000/api';
const KNOWN_ENVIRONMENTS = ['development', 'preview', 'production'];

const appEnvironment = process.env.EXPO_PUBLIC_APP_ENV ?? 'development';

if (!KNOWN_ENVIRONMENTS.includes(appEnvironment)) {
  console.warn(`EXPO_PUBLIC_APP_ENV desconhecido: "${appEnvironment}". A usar "development".`);
}

/**
 * Configuração pública disponível na aplicação.
 *
 * Não guardar tokens, passwords ou chaves privadas neste objeto: qualquer
 * variável EXPO_PUBLIC_* pode ser lida por quem instalar a aplicação.
 */
export const env = Object.freeze({
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL,
  appEnvironment: KNOWN_ENVIRONMENTS.includes(appEnvironment) ? appEnvironment : 'development',
  isDevelopment: appEnvironment === 'development',
});
