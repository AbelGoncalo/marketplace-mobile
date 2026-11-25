import Ionicons from '@expo/vector-icons/Ionicons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthScreenLayout } from '@/features/auth/components/AuthScreenLayout';
import { FormField } from '@/features/auth/components/FormField';
import {
  forgotPasswordSchema,
  forgotPasswordSmsSchema,
  resetPasswordSmsSchema,
} from '@/features/auth/schemas/authSchemas';
import {
  requestPasswordReset,
  requestPasswordResetSms,
  resetPasswordSms,
} from '@/features/auth/services/authApi';
import { AppText, Button } from '@/shared/ui';
import { colors, radii, spacing } from '@/theme';

export function ForgotPasswordScreen() {
  const router = useRouter();
  const [method, setMethod] = useState('email');
  const [requestError, setRequestError] = useState('');
  const [sentEmail, setSentEmail] = useState('');
  const [smsPhone, setSmsPhone] = useState('');
  const [smsStep, setSmsStep] = useState('request');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const emailForm = useForm({
    defaultValues: { email: '' },
    resolver: zodResolver(forgotPasswordSchema),
  });
  const phoneForm = useForm({
    defaultValues: { phone: '' },
    resolver: zodResolver(forgotPasswordSmsSchema),
  });
  const smsResetForm = useForm({
    defaultValues: { code: '', password: '', passwordConfirmation: '' },
    resolver: zodResolver(resetPasswordSmsSchema),
  });

  /** Troca o método e remove mensagens que pertenciam ao método anterior. */
  function selectMethod(nextMethod) {
    setMethod(nextMethod);
    setRequestError('');
  }

  /** A resposta é neutra para não revelar se o email está registado. */
  async function submitEmail({ email }) {
    setRequestError('');
    try {
      await requestPasswordReset(email);
      setSentEmail(email);
    } catch (error) {
      setRequestError(error.message);
    }
  }

  /** Solicita o código e conserva o telefone para a segunda etapa. */
  async function submitPhone({ phone }) {
    setRequestError('');
    try {
      await requestPasswordResetSms(phone);
      setSmsPhone(phone);
      setSmsStep('code');
    } catch (error) {
      setRequestError(error.message);
    }
  }

  /** Envia código e senhas no formato exigido pelo endpoint SMS. */
  async function submitSmsReset(values) {
    setRequestError('');
    try {
      await resetPasswordSms({ ...values, phone: smsPhone });
      setSmsStep('complete');
    } catch (error) {
      setRequestError(error.message);
    }
  }

  /** Um novo código invalida o anterior; por isso limpamos o campo do código. */
  async function resendSmsCode() {
    setRequestError('');
    setIsResending(true);
    try {
      await requestPasswordResetSms(smsPhone);
      smsResetForm.resetField('code');
    } catch (error) {
      setRequestError(error.message);
    } finally {
      setIsResending(false);
    }
  }

  if (sentEmail) {
    return (
      <AuthScreenLayout
        description="Enviámos as instruções de recuperação."
        formCard
        title="Consulte o seu email"
      >
        <StatusIcon color={colors.success} icon="mail-unread-outline" tone={colors.successSoft} />
        <AppText style={styles.centerText}>
          Se existir uma conta associada a <AppText variant="bodyStrong">{sentEmail}</AppText>,
          receberá um link para definir uma nova senha.
        </AppText>
        <InfoBox text="Verifique também as pastas de spam ou correio não solicitado." />
        <Button fullWidth label="Voltar ao login" onPress={() => router.replace('/(auth)/login')} />
        <Button
          fullWidth
          label="Enviar novamente"
          onPress={() => setSentEmail('')}
          variant="outline"
        />
      </AuthScreenLayout>
    );
  }

  if (method === 'sms' && smsStep === 'complete') {
    return (
      <AuthScreenLayout
        description="A sua nova senha já pode ser utilizada."
        formCard
        title="Senha redefinida"
      >
        <StatusIcon
          color={colors.success}
          icon="checkmark-circle-outline"
          tone={colors.successSoft}
        />
        <AppText style={styles.centerText}>
          A recuperação por SMS foi concluída. Autentique-se novamente.
        </AppText>
        <Button
          fullWidth
          label="Entrar na minha conta"
          onPress={() => router.replace('/(auth)/login')}
        />
      </AuthScreenLayout>
    );
  }

  const showingSmsCode = method === 'sms' && smsStep === 'code';

  return (
    <AuthScreenLayout
      description={
        showingSmsCode
          ? `Introduza o código enviado para ${smsPhone}.`
          : 'Escolha como pretende receber as instruções de recuperação.'
      }
      formCard
      title={showingSmsCode ? 'Confirme o código' : 'Recuperar acesso'}
    >
      {!showingSmsCode ? <MethodSelector method={method} onSelect={selectMethod} /> : null}

      {method === 'email' ? (
        <>
          <FormField
            autoCapitalize="none"
            autoComplete="email"
            control={emailForm.control}
            error={emailForm.formState.errors.email?.message}
            keyboardType="email-address"
            label="Email"
            leftElement={<Ionicons color={colors.textMuted} name="mail-outline" size={20} />}
            name="email"
            placeholder="nome@exemplo.com"
          />
          <RequestError message={requestError} />
          <Button
            fullWidth
            label="Enviar link de recuperação"
            loading={emailForm.formState.isSubmitting}
            onPress={emailForm.handleSubmit(submitEmail)}
          />
        </>
      ) : null}

      {method === 'sms' && smsStep === 'request' ? (
        <>
          <FormField
            autoComplete="tel"
            control={phoneForm.control}
            error={phoneForm.formState.errors.phone?.message}
            helperText="Digite apenas os 9 dígitos do número angolano."
            keyboardType="phone-pad"
            label="Número de telefone"
            leftElement={<Ionicons color={colors.textMuted} name="call-outline" size={20} />}
            name="phone"
            placeholder="923000000"
            maxLength={9}
          />
          <RequestError message={requestError} />
          <Button
            fullWidth
            label="Enviar código por SMS"
            loading={phoneForm.formState.isSubmitting}
            onPress={phoneForm.handleSubmit(submitPhone)}
          />
        </>
      ) : null}

      {showingSmsCode ? (
        <SmsCodeForm
          form={smsResetForm}
          isResending={isResending}
          onChangePhone={() => {
            setRequestError('');
            setSmsStep('request');
          }}
          onResend={resendSmsCode}
          onSubmit={submitSmsReset}
          passwordVisible={passwordVisible}
          requestError={requestError}
          setPasswordVisible={setPasswordVisible}
        />
      ) : null}

      {!showingSmsCode ? (
        <Button fullWidth label="Voltar ao login" onPress={() => router.back()} variant="outline" />
      ) : null}
      <AppText color="muted" style={styles.centerText} variant="caption">
        Por segurança, códigos e links são temporários e só podem ser utilizados uma vez.
      </AppText>
    </AuthScreenLayout>
  );
}

function MethodSelector({ method, onSelect }) {
  return (
    <View accessibilityRole="tablist" style={styles.methodSelector}>
      {[
        { id: 'email', icon: 'mail-outline', label: 'Email' },
        { id: 'sms', icon: 'chatbubble-ellipses-outline', label: 'SMS' },
      ].map((option) => {
        const selected = method === option.id;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={option.id}
            onPress={() => onSelect(option.id)}
            style={[styles.methodOption, selected && styles.methodOptionSelected]}
          >
            <Ionicons
              color={selected ? colors.textOnPrimary : colors.textMuted}
              name={option.icon}
              size={19}
            />
            <AppText color={selected ? 'inverse' : 'muted'} variant="bodyStrong">
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function SmsCodeForm({
  form,
  isResending,
  onChangePhone,
  onResend,
  onSubmit,
  passwordVisible,
  requestError,
  setPasswordVisible,
}) {
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
    <>
      <InfoBox text="O código possui 6 dígitos e expira em poucos minutos." />
      <FormField
        autoComplete="sms-otp"
        control={form.control}
        error={form.formState.errors.code?.message}
        keyboardType="number-pad"
        label="Código recebido"
        leftElement={<Ionicons color={colors.textMuted} name="keypad-outline" size={20} />}
        maxLength={6}
        name="code"
        placeholder="000000"
      />
      <FormField
        autoComplete="new-password"
        control={form.control}
        error={form.formState.errors.password?.message}
        label="Nova senha"
        leftElement={<Ionicons color={colors.textMuted} name="lock-closed-outline" size={20} />}
        name="password"
        placeholder="Introduza a nova senha"
        rightElement={visibilityButton}
        secureTextEntry={!passwordVisible}
      />
      <FormField
        autoComplete="new-password"
        control={form.control}
        error={form.formState.errors.passwordConfirmation?.message}
        label="Confirmar nova senha"
        leftElement={<Ionicons color={colors.textMuted} name="lock-closed-outline" size={20} />}
        name="passwordConfirmation"
        placeholder="Repita a nova senha"
        rightElement={visibilityButton}
        secureTextEntry={!passwordVisible}
      />
      <RequestError message={requestError} />
      <Button
        fullWidth
        label="Redefinir senha"
        loading={form.formState.isSubmitting}
        onPress={form.handleSubmit(onSubmit)}
      />
      <Button
        fullWidth
        label="Reenviar código"
        loading={isResending}
        onPress={onResend}
        variant="outline"
      />
      <Pressable accessibilityRole="button" onPress={onChangePhone} style={styles.textAction}>
        <AppText color="primary" variant="bodyStrong">
          Alterar número de telefone
        </AppText>
      </Pressable>
    </>
  );
}

function RequestError({ message }) {
  if (!message) return null;
  return (
    <View style={styles.errorBox}>
      <Ionicons color={colors.danger} name="alert-circle-outline" size={20} />
      <AppText color="danger" style={styles.flexText}>
        {message}
      </AppText>
    </View>
  );
}

function InfoBox({ text }) {
  return (
    <View style={styles.tipBox}>
      <Ionicons color={colors.primary} name="information-circle-outline" size={21} />
      <AppText color="muted" style={styles.flexText}>
        {text}
      </AppText>
    </View>
  );
}

function StatusIcon({ color, icon, tone }) {
  return (
    <View style={[styles.statusIcon, { backgroundColor: tone }]}>
      <Ionicons color={color} name={icon} size={40} />
    </View>
  );
}

const styles = StyleSheet.create({
  statusIcon: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: radii.pill,
    height: 76,
    justifyContent: 'center',
    width: 76,
  },
  centerText: { textAlign: 'center' },
  methodSelector: {
    backgroundColor: colors.background,
    borderRadius: radii.sm,
    flexDirection: 'row',
    padding: 4,
  },
  methodOption: {
    alignItems: 'center',
    borderRadius: radii.sm,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 44,
  },
  methodOptionSelected: { backgroundColor: colors.primary },
  tipBox: {
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
  flexText: { flex: 1 },
  textAction: { alignItems: 'center', padding: spacing.sm },
});
