import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable } from 'react-native';
import { useAuth } from '@/features/auth/context/AuthContext';
import { changePassword, passwordErrors } from '@/features/profile/services/passwordApi';
import { ReturnLayout, ReturnPanel } from '@/features/returns/components/ReturnLayout';
import { AppText, Button, Input } from '@/shared/ui';
import { colors } from '@/theme';

/** Protege o formulário e isola os segredos quando a sessão muda. */
export default function SecurityScreen() {
  const { session, clearSession } = useAuth();
  if (!session) return <AppText>Entre na sua conta para alterar a palavra-passe.</AppText>;
  return <PasswordForm key={session.token} token={session.token} clearSession={clearSession} />;
}

/** Mantém palavras-passe apenas em memória e exige novo login depois da confirmação do servidor. */
function PasswordForm({ token, clearSession }) {
  const router = useRouter();
  const [values, setValues] = useState({
    current_password: '',
    password: '',
    password_confirmation: '',
  });
  const [errors, setErrors] = useState({});
  const [visible, setVisible] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const active = useRef(false);
  const lock = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  /** Limpa só a sessão correspondente; não chama logout com um token que a API já invalidou. */
  async function loginAgain() {
    await clearSession(token);
    router.replace('/(auth)/login');
  }

  /** Bloqueia toques repetidos e distingue validação de uma alteração cujo resultado ficou incerto. */
  async function submit() {
    if (lock.current || uncertain) return;
    const validation = passwordErrors(values);
    setErrors(validation);
    if (Object.keys(validation).length) return;
    lock.current = true;
    setBusy(true);
    setMessage('');
    try {
      await changePassword(token, values);
      if (active.current) {
        setValues({ current_password: '', password: '', password_confirmation: '' });
        setUncertain(true);
      }
      await loginAgain();
    } catch (failure) {
      if (active.current) {
        setErrors(
          Object.fromEntries(
            Object.entries(failure.errors || {}).map(([field, error]) => [
              field,
              Array.isArray(error) ? error.join(' ') : String(error),
            ]),
          ),
        );
        const unknown = failure.status === 0 || failure.status >= 500;
        if (unknown) setUncertain(true);
        setMessage(
          unknown
            ? 'Não foi possível confirmar a alteração. Entre novamente e verifique a nova palavra-passe antes de repetir.'
            : failure.message,
        );
      }
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
    }
  }
  return (
    <ReturnLayout
      title="Segurança"
      subtitle="Altere a sua palavra-passe."
      backTo="/(customer)/(tabs)/profile"
      busy={busy}
    >
      <ReturnPanel title="Alterar palavra-passe">
        <AppText color="muted">
          Após guardar, terá de entrar novamente. Use pelo menos 8 caracteres, uma maiúscula, uma
          minúscula e um número.
        </AppText>
        {Object.keys(values).map((field) => (
          <Input
            key={field}
            label={
              {
                current_password: 'Palavra-passe atual',
                password: 'Nova palavra-passe',
                password_confirmation: 'Confirmar nova palavra-passe',
              }[field]
            }
            value={values[field]}
            onChangeText={(value) => setValues((previous) => ({ ...previous, [field]: value }))}
            error={errors[field]}
            editable={!busy && !uncertain}
            secureTextEntry={!visible[field]}
            autoCapitalize="none"
            autoCorrect={false}
            rightElement={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  visible[field] ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'
                }
                disabled={busy}
                onPress={() =>
                  setVisible((previous) => ({ ...previous, [field]: !previous[field] }))
                }
                style={{
                  minWidth: 44,
                  minHeight: 44,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons
                  name={visible[field] ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={colors.textMuted}
                />
              </Pressable>
            }
          />
        ))}
        {message ? (
          <AppText accessibilityRole="alert" color="danger">
            {message}
          </AppText>
        ) : null}
        {uncertain ? (
          <Button label="Entrar novamente" fullWidth onPress={loginAgain} disabled={busy} />
        ) : (
          <Button label="Guardar nova palavra-passe" fullWidth loading={busy} onPress={submit} />
        )}
      </ReturnPanel>
    </ReturnLayout>
  );
}
