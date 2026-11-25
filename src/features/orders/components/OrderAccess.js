import { useRouter } from 'expo-router';

import { useAuth } from '@/features/auth/context/AuthContext';
import { AppText, Button, Screen } from '@/shared/ui';

/** Impede montar consultas privadas sem uma sessão de Cliente e isola a troca de conta. */
export function OrderAccess({
  children,
  title = 'As minhas encomendas',
  description = 'Entre para consultar as suas compras.',
  returnTo = 'orders',
}) {
  const { session } = useAuth();
  const router = useRouter();
  if (!session)
    return (
      <Screen>
        <AppText variant="heading1">{title}</AppText>
        <AppText>{description}</AppText>
        <Button
          label="Entrar"
          onPress={() => router.push({ pathname: '/(auth)/login', params: { returnTo } })}
        />
      </Screen>
    );
  if (session.user.accountType !== 'Cliente')
    return (
      <Screen>
        <AppText>Esta área está disponível para contas de Cliente.</AppText>
        <Button
          label="Voltar ao perfil"
          onPress={() => router.replace('/(customer)/(tabs)/profile')}
        />
      </Screen>
    );
  return children(session);
}
