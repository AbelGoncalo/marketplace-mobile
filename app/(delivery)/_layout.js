import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/features/auth/context/AuthContext';
/** A API autoriza o tipo Entregador; não exige um papel RBAC inexistente no contrato. */
export default function DeliveryLayout() {
  const { session, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;
  if (session?.user.accountType !== 'Entregador')
    return <Redirect href="/(customer)/(tabs)/profile" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
