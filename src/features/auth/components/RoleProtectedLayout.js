import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/features/auth/context/AuthContext';
import { canAccessRole } from '@/features/auth/utils/accessControl';

/** Protege um grupo inteiro e evita repetir a mesma regra em todas as suas telas. */
export function RoleProtectedLayout({ role }) {
  const { isAuthenticated, session } = useAuth();

  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;
  if (!canAccessRole(session, role)) return <Redirect href="/(customer)/(tabs)/profile" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
