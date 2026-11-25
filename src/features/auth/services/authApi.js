import { apiRequest } from '@/services/http/apiClient';

export function getCurrentAccess(token) {
  return apiRequest('/auth/me', { token });
}

export function logout(token) {
  return apiRequest('/auth/logout', { token, method: 'POST' });
}

export function getRegisterOptions() {
  return apiRequest('/auth/register-options');
}

export function getMunicipalities(provinceId) {
  return apiRequest(`/auth/register-options/municipalities?province_id=${provinceId}`);
}

export function register(payload) {
  return apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
}

export function login({ email, password }) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login: email, password }),
  });
}

export function requestPasswordReset(email) {
  return apiRequest('/auth/forgot-password', {
    method: 'POST',
    // Identifica a origem para a API enviar o deep link configurado para o mobile.
    body: JSON.stringify({ email, channel: 'mobile' }),
  });
}

/** Solicita à API um código SMS para o telefone informado. */
export function requestPasswordResetSms(phone) {
  return apiRequest('/auth/forgot-password/sms', {
    method: 'POST',
    body: JSON.stringify({ phone: toAngolaE164(phone) }),
  });
}

export function resetPassword({ email, token, password, passwordConfirmation }) {
  return apiRequest('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({
      email,
      token,
      password,
      password_confirmation: passwordConfirmation,
    }),
  });
}

/** Conclui a recuperação por SMS usando o código de seis dígitos. */
export function resetPasswordSms({ phone, code, password, passwordConfirmation }) {
  return apiRequest('/auth/reset-password/sms', {
    method: 'POST',
    body: JSON.stringify({
      phone: toAngolaE164(phone),
      code,
      password,
      password_confirmation: passwordConfirmation,
    }),
  });
}

/** Acrescenta o indicativo de Angola sem o expor como obrigação no formulário. */
function toAngolaE164(phone) {
  return `+244${phone}`;
}

/** Traduz o modelo amigável do formulário para o contrato exigido pelo Laravel. */
export function buildRegisterPayload(values, selectedAccount) {
  const payload = {
    user_type_id: selectedAccount.userTypeId,
    account_type: selectedAccount.kind,
    email: values.email,
    phone: values.phone,
    password: values.password,
    password_confirmation: values.passwordConfirmation,
  };

  if (selectedAccount.kind === 'entity') {
    payload.entity = {
      name: values.storeName,
      entity_type_id: Number(values.entityTypeId),
      nif: values.taxNumber || null,
    };
  } else {
    payload.person = {
      name: values.name,
      gender_id: values.genderId ? Number(values.genderId) : null,
      bi_number: values.identityNumber || null,
      municipality_id: Number(values.municipalityId),
      address: values.address,
    };
  }

  return payload;
}

/** Converte a estrutura detalhada da API para o formato pequeno guardado no dispositivo. */
export function createSession(data) {
  const access = data.access;
  const roles = access.user?.user_type?.roles || [];
  return {
    token: data.access_token,
    user: {
      id: access.id,
      email: access.email,
      name:
        access.user?.person?.name ||
        access.user?.entity?.name ||
        access.username ||
        'Administrador',
      accountType: access.user?.user_type?.name,
      roles: roles.map((role) => role.slug),
      permissions: roles.flatMap((role) =>
        (role.permissions || []).map((permission) => permission.slug),
      ),
    },
  };
}
