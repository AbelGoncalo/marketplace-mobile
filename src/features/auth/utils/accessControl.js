/** Verifica apenas os papéis explícitos devolvidos pela API. */
export function hasRole(session, role) {
  return session?.user?.roles?.includes(role) ?? false;
}

export function canAccessRole(session, role) {
  return hasRole(session, role);
}

/** Devolve o painel administrativo permitido ou null para utilizadores comuns. */
export function getManagementRoute(session) {
  if (canAccessRole(session, 'super-admin')) {
    return '/(super-admin)/super-admin';
  }
  if (canAccessRole(session, 'shopping-center-admin')) {
    return '/(shopping-center-admin)/shopping-center';
  }
  if (canAccessRole(session, 'store-owner')) {
    return '/(merchant)/merchant';
  }
  // O painel operacional usa o mesmo tipo de conta exigido pela API logística.
  if (session?.user?.accountType === 'Entregador') return '/(delivery)/delivery';
  return null;
}

/** Decide a área inicial depois da autenticação. */
export function getPostLoginRoute(session) {
  return getManagementRoute(session) || '/(customer)/(tabs)/profile';
}
