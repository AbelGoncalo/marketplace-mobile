import { env } from '@/config/env';

const unauthorizedListeners = new Set();

export function onUnauthorized(listener) {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

/** Erro previsível de API, com status e erros de validação do Laravel. */
export class ApiError extends Error {
  constructor(message, status, errors = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

/**
 * Cliente HTTP central da aplicação.
 * Centralizar fetch permite adicionar token, refresh e logs num único lugar futuramente.
 */
export async function apiRequest(path, options = {}) {
  const url = `${env.apiUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  const {
    token,
    includeResponseMetadata = false,
    responseType = 'json',
    timeoutMs = 15000,
    ...fetchOptions
  } = options;
  // FormData precisa do separador criado pelo fetch; impor JSON impediria o envio dos ficheiros.
  const multipart = typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(!multipart ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
    // Downloads privados devolvem bytes; respostas de erro continuam no contrato JSON da API.
    if (response.ok && responseType === 'arrayBuffer') return await response.arrayBuffer();
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      if (response.status === 401 && token) {
        unauthorizedListeners.forEach((listener) => listener(token));
      }
      throw new ApiError(
        body?.message || 'Não foi possível concluir o pedido.',
        response.status,
        body?.errors,
      );
    }

    // O checkout pode comparar a validade com a data do servidor, sem depender do relógio local.
    if (includeResponseMetadata) {
      return {
        data: body?.data,
        serverDate: response.headers?.get?.('Date') || null,
        receivedAt: Date.now(),
      };
    }
    return body?.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      'Não foi possível ligar ao servidor. Verifique a rede e tente novamente.',
      0,
    );
  } finally {
    clearTimeout(timeout);
  }
}
