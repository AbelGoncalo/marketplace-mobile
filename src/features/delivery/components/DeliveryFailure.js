import { useEffect, useRef, useState } from 'react';
import { DeliveryActionRow } from '@/features/delivery/components/DeliveryCards';
import { ReturnPanel } from '@/features/returns/components/ReturnLayout';
import { AppText, Button, Input } from '@/shared/ui';

/** Regista uma falha justificada uma única vez; o motivo só viaja neste pedido. */
export function DeliveryFailure({ execute, onRefresh, onBusy, Panel = ReturnPanel }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unknown, setUnknown] = useState(false);
  const lock = useRef(false);
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      setReason('');
    };
  }, []);
  /** Um resultado incerto exige consulta do estado antes de qualquer nova tentativa. */
  async function submit() {
    if (lock.current || unknown) return;
    lock.current = true;
    setBusy(true);
    onBusy(true);
    setError('');
    try {
      await execute(reason);
      if (!active.current) return;
      setReason('');
      setOpen(false);
      onRefresh();
    } catch (failure) {
      if (active.current) {
        const uncertain = !failure.status || failure.status >= 500;
        setUnknown(uncertain);
        setError(
          uncertain
            ? 'Não foi possível registar a falha. Consulte o estado antes de repetir.'
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
  return (
    <Panel title="Problema na entrega">
      <AppText color="muted">
        Se não foi possível concluir a recolha, o transporte ou a entrega, registe o motivo. A
        transportadora recebe a notificação e decide o próximo passo.
      </AppText>
      {error ? (
        <AppText color="danger" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
      {unknown ? (
        <Button label="Consultar estado" fullWidth onPress={onRefresh} />
      ) : open ? (
        <>
          <Input
            label="Motivo da falha"
            value={reason}
            onChangeText={setReason}
            placeholder="Descreva o que aconteceu"
            multiline
            textAlignVertical="top"
            maxLength={2000}
            editable={!busy}
            style={{ minHeight: 96 }}
          />
          <AppText variant="bodyStrong">Registar esta falha na entrega?</AppText>
          <Button
            label="Confirmar falha"
            fullWidth
            loading={busy}
            disabled={!reason.trim()}
            onPress={submit}
          />
          <Button
            label="Voltar"
            fullWidth
            variant="outline"
            disabled={busy}
            onPress={() => {
              setOpen(false);
              setReason('');
              setError('');
            }}
          />
        </>
      ) : (
        <DeliveryActionRow
          label="Comunicar falha"
          variant="danger"
          icon="alert"
          onPress={() => {
            setOpen(true);
            setError('');
          }}
        />
      )}
    </Panel>
  );
}
