import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getCurrentAccess } from '@/features/auth/services/authApi';
import { apiRequest } from '@/services/http/apiClient';
import { ReturnPanel } from '@/features/returns/components/ReturnLayout';
import { AppText, Badge, Button, Input } from '@/shared/ui';

/** Mantém códigos apenas na memória e consulta o telefone guardado, separado dos campos em edição. */
export function PhoneVerification({ token, disabled, onBusy }) {
  const [access, setAccess] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);
  const active = useRef(false);
  const lock = useRef(false);
  useFocusEffect(
    useCallback(() => {
      active.current = true;
      let current = true;
      // Uma nova consulta limpa códigos antigos; os limites reais são sempre aplicados pela API.
      if (revision >= 0) setCode('');
      getCurrentAccess(token)
        .then((value) => {
          if (current) setAccess(value);
        })
        .catch((error) => {
          if (current) setMessage(error.message);
        });
      return () => {
        current = false;
        active.current = false;
      };
    }, [token, revision]),
  );

  /** Nunca repete automaticamente envios de SMS ou confirmações com resposta incerta. */
  async function execute(confirm) {
    if (lock.current || disabled) return;
    lock.current = true;
    setBusy(true);
    onBusy(true);
    setMessage('');
    try {
      await apiRequest(confirm ? '/auth/verify-phone' : '/auth/phone/verification-code', {
        token,
        method: 'POST',
        ...(confirm ? { body: JSON.stringify({ code }) } : {}),
      });
      const current = await getCurrentAccess(token);
      if (active.current) {
        setAccess(current);
        setCode('');
        setMessage(
          confirm
            ? 'Telefone verificado.'
            : 'Código enviado. Expira em 10 minutos. Aguarde 60 segundos antes de reenviar.',
        );
      }
    } catch (error) {
      if (active.current)
        setMessage(
          Object.values(error.errors || {})
            .flat()
            .join('\n') || error.message,
        );
    } finally {
      lock.current = false;
      onBusy(false);
      if (active.current) setBusy(false);
    }
  }
  return (
    <ReturnPanel title="Verificação do telefone">
      <AppText color="muted">{access?.phone || 'Sem telefone guardado'}</AppText>
      {access ? (
        <Badge
          label={access.phone_verified_at ? 'Verificado' : 'Por verificar'}
          variant={access.phone_verified_at ? 'success' : 'warning'}
        />
      ) : null}
      <AppText variant="caption" color="muted">
        Guarde alterações ao telefone antes de pedir o SMS. O código permite cinco tentativas e é
        válido durante 10 minutos.
      </AppText>
      {access?.phone && !access.phone_verified_at ? (
        <>
          <Button
            label="Enviar ou reenviar código SMS"
            variant="outline"
            fullWidth
            disabled={disabled || busy}
            onPress={() => execute(false)}
          />
          <Input
            label="Código recebido"
            value={code}
            onChangeText={(text) => setCode(text.replace(/\D/g, ''))}
            keyboardType="number-pad"
            maxLength={6}
            editable={!disabled && !busy}
            autoComplete="sms-otp"
          />
          <Button
            label="Confirmar telefone"
            fullWidth
            loading={busy}
            disabled={disabled || code.length !== 6}
            onPress={() => execute(true)}
          />
        </>
      ) : null}
      <Button
        label="Atualizar estado do telefone"
        variant="outline"
        fullWidth
        disabled={disabled || busy}
        onPress={() => setRevision((value) => value + 1)}
      />
      {message ? <AppText accessibilityRole="alert">{message}</AppText> : null}
    </ReturnPanel>
  );
}
