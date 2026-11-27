import { useEffect, useRef, useState } from 'react';
import { orderDate } from '@/features/orders/utils/orderPresentation';
import {
  DeliveryActionRow,
  deliveryActionIcons,
} from '@/features/delivery/components/DeliveryCards';
import { ReturnPanel } from '@/features/returns/components/ReturnLayout';
import { AppText, Button, Input } from '@/shared/ui';

/** Confirma operações presenciais uma única vez e mantém códigos apenas em memória. */
export function PickupActions({
  title,
  actions,
  execute,
  onRefresh,
  onBusy,
  hint,
  issuedHint = 'Apresente este código apenas ao entregador atribuído.',
  issuedNotice,
  needsCode = false,
  // Permite adaptar a apresentação do lojista sem alterar o fluxo partilhado com o entregador.
  Panel = ReturnPanel,
}) {
  const [selected, setSelected] = useState(null);
  const [code, setCode] = useState('');
  const [issued, setIssued] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unknown, setUnknown] = useState(false);
  const lock = useRef(false);
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  /** Um erro de rede exige consulta antes de repetir; nenhum PATCH/POST é repetido automaticamente. */
  async function submit() {
    if (lock.current || unknown || !selected) return;
    lock.current = true;
    setBusy(true);
    onBusy(true);
    setError('');
    setIssued(null);
    try {
      const result = await execute(selected.action, code);
      if (!active.current) return;
      setCode('');
      setSelected(null);
      if (result?.pickup_confirmation?.pickup_code) setIssued(result.pickup_confirmation);
      else onRefresh();
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
  return (
    <Panel title={title}>
      <AppText color="muted">{hint}</AppText>
      {error ? (
        <AppText color="danger" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
      {issued ? (
        <>
          <AppText variant="caption" color="muted">
            {issuedHint}
          </AppText>
          <AppText
            variant="heading1"
            accessibilityLabel={`Código de recolha: ${issued.pickup_code}`}
          >
            {issued.pickup_code}
          </AppText>
          <AppText variant="caption" color="muted">
            Validade: {orderDate(issued.expires_at)}
          </AppText>
          <AppText variant="caption" color="muted">
            Código temporário. Ao sair deste ecrã deixa de estar visível. Um novo código invalida o
            anterior.
          </AppText>
          {issuedNotice ? (
            <AppText variant="bodyStrong" color="primary">
              {issuedNotice}
            </AppText>
          ) : null}
          <Button label="Concluir e atualizar" fullWidth onPress={onRefresh} />
        </>
      ) : unknown ? (
        <Button label="Consultar estado" fullWidth onPress={onRefresh} />
      ) : selected ? (
        <>
          {needsCode ? (
            <Input
              label="Código de recolha"
              value={code}
              onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              editable={!busy}
              autoComplete="off"
            />
          ) : null}
          <AppText variant="bodyStrong">{selected.confirmation}</AppText>
          <Button
            label="Confirmar"
            fullWidth
            loading={busy}
            disabled={needsCode && code.length !== 6}
            onPress={submit}
          />
          <Button
            label="Voltar"
            fullWidth
            variant="outline"
            disabled={busy}
            onPress={() => {
              setSelected(null);
              setCode('');
              setError('');
            }}
          />
        </>
      ) : (
        actions.map((action) =>
          action.secondary ? (
            <Button
              key={action.action}
              label={action.label}
              fullWidth
              variant="outline"
              onPress={() => {
                setSelected(action);
                setError('');
              }}
            />
          ) : (
            <DeliveryActionRow
              key={action.action}
              label={action.label}
              icon={deliveryActionIcons[action.action]}
              onPress={() => {
                setSelected(action);
                setError('');
              }}
            />
          ),
        )
      )}
    </Panel>
  );
}
