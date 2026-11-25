import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CartProvider } from '@/features/cart/context/CartContext';
import { colors } from '@/theme';
import { AuthProvider, useAuth } from '@/features/auth/context/AuthContext';
import { AppText, Button, LoadingState, Screen } from '@/shared/ui';

/** Instala os providers de sessão e carrinho acima de todas as rotas. */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar backgroundColor={colors.primaryDark} style="light" />
      <AuthProvider>
        <CartProvider>
          <RootNavigator />
        </CartProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

/** Decide quais grupos de rotas estão disponíveis conforme a sessão. */
function RootNavigator() {
  const { isAuthenticated, isLoading, sessionError, retrySession } = useAuth();

  if (isLoading) {
    return <LoadingState message="A preparar a sua sessão..." />;
  }

  if (sessionError) {
    return (
      <Screen>
        <AppText>{sessionError}</AppText>
        <Button label="Tentar novamente" onPress={retrySession} />
      </Screen>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="(customer)" />
      <Stack.Screen name="(super-admin)" />
      <Stack.Screen name="(shopping-center-admin)" />
      <Stack.Screen name="(merchant)" />
      <Stack.Screen name="(delivery)" />
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
