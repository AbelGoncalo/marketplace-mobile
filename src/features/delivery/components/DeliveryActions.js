import { useEffect, useRef, useState } from 'react';
import { ReturnPanel } from '@/features/returns/components/ReturnLayout';
import { AppText, Button, Input } from '@/shared/ui';

/** Confirma o transporte e a entrega presencial sem conservar o código no dispositivo. */
export function DeliveryActions({ action, execute, onRefresh, onBusy, Panel = ReturnPanel }) {
  const [confirming, setConfirming] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unknown, setUnknown] = useState(false);
  const lock = useRef(false);
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      setCode('');
    };
  }, []);
  async function submit() {
    if (lock.current || unknown) return;
    lock.current = true;
    setBusy(true);
    onBusy(true);
    setError('');
    try {
      await execute(
        action,
        action === 'CONFIRM_DELIVERY'
          ? { recipient_name: recipientName, confirmation_code: code }
          : action === 'CONFIRM_RETURN_TO_STORE'
            ? { recipient_name: recipientName }
            : {},
      );
      if (!active.current) return;
      setCode('');
      setRecipientName('');
      setConfirming(false);
      onRefresh();
    } catch (failure) {
      if (active.current) {
        const uncertain = !failure.status || failure.status >= 500;
        setUnknown(uncertain);
        setError(
          uncertain
            ? 'Não foi possível confirmar a operação. Consulte o estado antes de repetir.'
            : failure.message,
        );
      }
    } finally {
      lock.current = false;
      if (active.current) {
        setBusy(false);
        onBusy(false);
      }
    }
  }
  const isDelivery = action === 'CONFIRM_DELIVERY';
  const isReturn = action === 'CONFIRM_RETURN_TO_STORE';
  const needsRecipient = isDelivery || isReturn;
  return (
    <Panel title="Próxima ação">
      <AppText color="muted">
        {isDelivery
          ? 'Peça ao cliente o código de entrega e registe o nome de quem recebeu a encomenda.'
          : isReturn
            ? 'Registe o nome de quem recebeu os produtos na loja de origem.'
            : 'Confirme apenas quando sair da loja com a encomenda para o endereço do cliente.'}
      </AppText>
      {error ? (
        <AppText color="danger" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
      {unknown ? (
        <Button label="Consultar estado" onPress={onRefresh} />
      ) : confirming ? (
        <>
          {needsRecipient ? (
            <Input
              label={isReturn ? 'Nome de quem recebeu na loja' : 'Nome de quem recebeu'}
              value={recipientName}
              onChangeText={setRecipientName}
              maxLength={180}
              editable={!busy}
              autoComplete="name"
            />
          ) : null}
          {isDelivery ? (
            <Input
              label="Código de entrega"
              value={code}
              onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              editable={!busy}
              autoComplete="off"
            />
          ) : null}
          <AppText variant="bodyStrong">
            {isDelivery
              ? 'Confirma que entregou esta encomenda à pessoa indicada?'
              : isReturn
                ? 'Confirma que os produtos ficaram na loja de origem?'
                : 'Vai iniciar agora o transporte até ao cliente?'}
          </AppText>
          <Button
            label="Confirmar"
            loading={busy}
            disabled={
              (needsRecipient && !recipientName.trim()) || (isDelivery && code.length !== 6)
            }
            onPress={submit}
          />
          <Button
            label="Voltar"
            variant="outline"
            disabled={busy}
            onPress={() => {
              setConfirming(false);
              setRecipientName('');
              setCode('');
              setError('');
            }}
          />
        </>
      ) : (
        <Button
          label={
            isDelivery
              ? 'Confirmar entrega'
              : isReturn
                ? 'Confirmar devolução'
                : 'Iniciar transporte'
          }
          onPress={() => setConfirming(true)}
        />
      )}
    </Panel>
  );
}
