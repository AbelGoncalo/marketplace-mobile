import { apiRequest } from '@/services/http/apiClient';

/** Aplica as regras públicas da API sem alterar espaços ou outros caracteres da palavra-passe. */
export function passwordErrors(values) {
  const errors = {};
  if (!values.current_password) errors.current_password = 'Indique a palavra-passe atual.';
  if (
    typeof values.password !== 'string' ||
    values.password.length < 8 ||
    !/[A-Z]/.test(values.password) ||
    !/[a-z]/.test(values.password) ||
    !/[0-9]/.test(values.password)
  )
    errors.password = 'Use pelo menos 8 caracteres, com maiúscula, minúscula e número.';
  if (!values.password_confirmation || values.password_confirmation !== values.password)
    errors.password_confirmation = 'As palavras-passe não coincidem.';
  return errors;
}

/** Envia uma única alteração autenticada; nunca repete automaticamente um pedido incerto. */
export function changePassword(token, values) {
  if (Object.keys(passwordErrors(values)).length)
    throw new Error('Verifique os campos da palavra-passe.');
  return apiRequest('/auth/password', {
    token,
    method: 'PUT',
    body: JSON.stringify({
      current_password: values.current_password,
      password: values.password,
      password_confirmation: values.password_confirmation,
    }),
  });
}
