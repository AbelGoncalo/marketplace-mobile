import Ionicons from '@expo/vector-icons/Ionicons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthScreenLayout } from '@/features/auth/components/AuthScreenLayout';
import { useAuth } from '@/features/auth/context/AuthContext';
import { loginSchema } from '@/features/auth/schemas/authSchemas';
import { getPostLoginRoute } from '@/features/auth/utils/accessControl';
import { AppText, Button, Input } from '@/shared/ui';
import { colors, radii, spacing } from '@/theme';

/** Autentica e permite retomar apenas destinos privados previamente conhecidos. */
export function LoginScreen() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams();
  const { signIn } = useAuth();
  const [submitError, setSubmitError] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { email: '', password: '' },
    resolver: zodResolver(loginSchema),
  });

  /** Só envia as credenciais quando o formulário passa na validação do Zod. */
  async function onSubmit(values) {
    setSubmitError('');
    try {
      const session = await signIn(values);
      router.replace(
        [
          'checkout',
          'orders',
          'returns',
          'refunds',
          'complaints',
          'addresses',
          'notifications',
          'favorites',
        ].includes(returnTo) && session.user.accountType === 'Cliente'
          ? {
              checkout: '/(customer)/checkout',
              orders: '/(customer)/orders',
              returns: '/(customer)/returns',
              // Retoma a consulta financeira após autenticação, sem aceitar destinos externos.
              refunds: '/(customer)/refunds',
              // Retoma a lista privada de reclamações sem aceitar redirecionamentos arbitrários.
              complaints: '/(customer)/complaints',
              // Retoma a gestão de moradas após entrada do Cliente.
              addresses: '/(customer)/profile/addresses',
              // Abre apenas o destino interno autorizado da caixa de notificações.
              notifications: '/(customer)/profile/notifications',
              favorites: '/(customer)/(tabs)/favorites',
            }[returnTo]
          : getPostLoginRoute(session),
      );
    } catch (requestError) {
      setSubmitError(requestError.message);
    }
  }

  return (
    <AuthScreenLayout
      description="Entre com segurança para continuar no Ponto Certo."
      formCard
      title="Bem-vindo de volta"
    >
      <View style={styles.secureLabel}>
        <Ionicons color={colors.success} name="shield-checkmark" size={17} />
        <AppText color="muted" variant="caption">
          ACESSO SEGURO
        </AppText>
      </View>

      <Controller
        control={control}
        name="email"
        render={({ field: { onBlur, onChange, value } }) => (
          <Input
            autoCapitalize="none"
            autoComplete="email"
            error={errors.email?.message}
            keyboardType="email-address"
            label="Email"
            leftElement={<Ionicons color={colors.textMuted} name="mail-outline" size={20} />}
            onBlur={onBlur}
            onChangeText={onChange}
            placeholder="nome@exemplo.com"
            value={value}
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field: { onBlur, onChange, value } }) => (
          <Input
            error={errors.password?.message}
            label="Senha"
            leftElement={<Ionicons color={colors.textMuted} name="lock-closed-outline" size={20} />}
            onBlur={onBlur}
            onChangeText={onChange}
            placeholder="Introduza a sua senha"
            rightElement={
              <Pressable
                accessibilityLabel={passwordVisible ? 'Ocultar senha' : 'Mostrar senha'}
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => setPasswordVisible((current) => !current)}
              >
                <Ionicons
                  color={colors.textMuted}
                  name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
                  size={21}
                />
              </Pressable>
            }
            secureTextEntry={!passwordVisible}
            value={value}
          />
        )}
      />

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/(auth)/forgot-password')}
        style={styles.forgotAction}
      >
        <Ionicons color={colors.primary} name="help-circle-outline" size={19} />
        <AppText color="primary" variant="bodyStrong">
          Esqueceu a senha?
        </AppText>
        <Ionicons color={colors.primary} name="chevron-forward" size={18} />
      </Pressable>

      {submitError ? (
        <View style={styles.errorBox}>
          <Ionicons color={colors.danger} name="alert-circle-outline" size={20} />
          <AppText color="danger" style={styles.errorText}>
            {submitError}
          </AppText>
        </View>
      ) : null}

      <Button
        fullWidth
        label="Entrar na minha conta"
        loading={isSubmitting}
        onPress={handleSubmit(onSubmit)}
      />

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <AppText color="muted" variant="caption">
          NOVO NO PONTO CERTO?
        </AppText>
        <View style={styles.dividerLine} />
      </View>
      <Button
        fullWidth
        label="Criar uma conta"
        onPress={() => router.push('/(auth)/register')}
        variant="outline"
      />
      <AppText color="muted" style={styles.terms} variant="caption">
        Ao entrar, confirma que aceita os termos e a política de privacidade.
      </AppText>
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  secureLabel: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.successSoft,
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  forgotAction: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 40,
  },
  errorBox: {
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  errorText: { flex: 1 },
  divider: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
  dividerLine: { backgroundColor: colors.border, flex: 1, height: 1 },
  terms: { textAlign: 'center' },
});
