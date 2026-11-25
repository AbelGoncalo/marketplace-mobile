import Ionicons from '@expo/vector-icons/Ionicons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthScreenLayout } from '@/features/auth/components/AuthScreenLayout';
import { FormField } from '@/features/auth/components/FormField';
import { useAuth } from '@/features/auth/context/AuthContext';
import { resetPasswordSchema } from '@/features/auth/schemas/authSchemas';
import { resetPassword } from '@/features/auth/services/authApi';
import { AppText, Button } from '@/shared/ui';
import { colors, radii, spacing } from '@/theme';

export function ResetPasswordScreen() {
  const router = useRouter();
  const { isAuthenticated, signOut } = useAuth();
  const params = useLocalSearchParams();
  const email = Array.isArray(params.email) ? params.email[0] : params.email;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const [requestError, setRequestError] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { password: '', passwordConfirmation: '' },
    resolver: zodResolver(resetPasswordSchema),
  });
  const hasValidLink = Boolean(email && token);

  /**
   * As telas de autenticação são protegidas enquanto existe uma sessão ativa.
   * Encerramos primeiro a sessão local para a navegação não ser bloqueada.
   */
  async function goToAuth(path) {
    if (isAuthenticated) await signOut();
    router.replace(path);
  }

  async function onSubmit(values) {
    setRequestError('');
    try {
      await resetPassword({ ...values, email, token });
      setIsComplete(true);
    } catch (error) {
      setRequestError(error.message);
    }
  }

  if (!hasValidLink) {
    return (
      <AuthScreenLayout
        description="O endereço não contém os dados necessários para redefinir a senha."
        formCard
        title="Link inválido"
      >
        <View style={styles.invalidIcon}>
          <Ionicons color={colors.danger} name="link-outline" size={36} />
        </View>
        <Button
          fullWidth
          label="Pedir novo link"
          onPress={() => goToAuth('/(auth)/forgot-password')}
        />
        <Button
          fullWidth
          label="Voltar ao login"
          onPress={() => goToAuth('/(auth)/login')}
          variant="outline"
        />
      </AuthScreenLayout>
    );
  }

  if (isComplete) {
    return (
      <AuthScreenLayout
        description="A sua nova senha já pode ser utilizada."
        formCard
        title="Senha redefinida"
      >
        <View style={styles.successIcon}>
          <Ionicons color={colors.success} name="checkmark-circle-outline" size={42} />
        </View>
        <AppText style={styles.centerText}>
          A alteração foi concluída. Por segurança, autentique-se novamente.
        </AppText>
        <Button fullWidth label="Entrar na minha conta" onPress={() => goToAuth('/(auth)/login')} />
      </AuthScreenLayout>
    );
  }

  const visibilityButton = (
    <Pressable
      accessibilityLabel={passwordVisible ? 'Ocultar senhas' : 'Mostrar senhas'}
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
  );

  return (
    <AuthScreenLayout
      description={`Defina uma nova senha para ${email}.`}
      formCard
      title="Criar nova senha"
    >
      <View style={styles.rulesBox}>
        <Ionicons color={colors.primary} name="shield-checkmark-outline" size={22} />
        <AppText color="muted" style={styles.rulesText} variant="caption">
          Use pelo menos 8 caracteres, incluindo maiúscula, minúscula e número.
        </AppText>
      </View>
      <FormField
        autoComplete="new-password"
        control={control}
        error={errors.password?.message}
        label="Nova senha"
        leftElement={<Ionicons color={colors.textMuted} name="lock-closed-outline" size={20} />}
        name="password"
        placeholder="Introduza a nova senha"
        rightElement={visibilityButton}
        secureTextEntry={!passwordVisible}
      />
      <FormField
        autoComplete="new-password"
        control={control}
        error={errors.passwordConfirmation?.message}
        label="Confirmar nova senha"
        leftElement={<Ionicons color={colors.textMuted} name="lock-closed-outline" size={20} />}
        name="passwordConfirmation"
        placeholder="Repita a nova senha"
        rightElement={visibilityButton}
        secureTextEntry={!passwordVisible}
      />
      {requestError ? (
        <View style={styles.errorBox}>
          <Ionicons color={colors.danger} name="alert-circle-outline" size={20} />
          <AppText color="danger" style={styles.rulesText}>
            {requestError}
          </AppText>
        </View>
      ) : null}
      <Button
        fullWidth
        label="Redefinir senha"
        loading={isSubmitting}
        onPress={handleSubmit(onSubmit)}
      />
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  invalidIcon: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.pill,
    height: 76,
    justifyContent: 'center',
    width: 76,
  },
  successIcon: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.successSoft,
    borderRadius: radii.pill,
    height: 76,
    justifyContent: 'center',
    width: 76,
  },
  centerText: { textAlign: 'center' },
  rulesBox: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  errorBox: {
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  rulesText: { flex: 1 },
});
