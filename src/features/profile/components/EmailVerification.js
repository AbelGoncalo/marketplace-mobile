import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getCurrentAccess } from '@/features/auth/services/authApi';
import { apiRequest } from '@/services/http/apiClient';
import { ReturnPanel } from '@/features/returns/components/ReturnLayout';
import { AppText, Badge, Button } from '@/shared/ui';

/** Consulta o email guardado sem substituir os campos que o Cliente está a editar. */
export function EmailVerification({ token, disabled }) {
  const [access, setAccess] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);
  const active = useRef(false);
  const lock = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (disabled) return;
      if (revision > 0) setMessage('');
      active.current = true;
      let current = true;
      getCurrentAccess(token)
        .then((result) => {
          if (current) setAccess(result);
        })
        .catch((error) => {
          if (current) setMessage(error.message);
        });
      return () => {
        current = false;
        active.current = false;
      };
    }, [token, revision, disabled]),
  );

  /** O servidor escolhe o destinatário; nunca envia o email ainda não guardado no formulário. */
  async function send() {
    if (lock.current || disabled) return;
    lock.current = true;
    setBusy(true);
    setMessage('');
    try {
      await apiRequest('/auth/email/verification-notification', { token, method: 'POST' });
      if (active.current)
        setMessage('Ligação enviada para o email guardado. Abra-a e depois atualize o estado.');
    } catch (error) {
      if (active.current) setMessage(error.message);
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
    }
  }
  return (
    <ReturnPanel title="Verificação de email">
      <AppText color="muted">{access?.email || 'A consultar email guardado...'}</AppText>
      {access ? (
        <Badge
          label={access.email_verified_at ? 'Verificado' : 'Por verificar'}
          variant={access.email_verified_at ? 'success' : 'warning'}
        />
      ) : null}
      <AppText variant="caption" color="muted">
        Se alterou o email acima, guarde primeiro. A ligação é enviada para o contacto guardado na
        conta.
      </AppText>
      {access && !access.email_verified_at ? (
        <Button
          label="Enviar ligação de verificação"
          fullWidth
          onPress={send}
          loading={busy}
          disabled={disabled}
        />
      ) : null}
      <Button
        label="Atualizar estado"
        variant="outline"
        fullWidth
        disabled={disabled || busy}
        onPress={() => {
          setMessage('');
          setRevision((value) => value + 1);
        }}
      />
      {message ? <AppText accessibilityRole="alert">{message}</AppText> : null}
    </ReturnPanel>
  );
}
