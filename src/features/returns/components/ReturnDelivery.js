import { useFocusEffect } from 'expo-router';
import { PickupAddressCorrection } from '@/features/returns/components/PickupAddressCorrection';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { getAddresses } from '@/features/checkout/services/checkoutApi';
import { ReturnFeedback } from '@/features/returns/components/ReturnLayout';
import {
  ReturnDetailPanel,
  ReturnDetailHistory,
} from '@/features/returns/components/ReturnDetailCards';
import {
  chooseReturnDelivery,
  canCorrectPickupAddress,
  getReturnDelivery,
  issueReturnDeliveryCode,
  returnDeliveryStatus,
} from '@/features/returns/services/returnDeliveryApi';
import { returnError, returnOutcomeUnknown } from '@/features/returns/services/returnsApi';
import { useApiQuery } from '@/shared/hooks/useApiQuery';
import { AppText, Badge, Button, Select } from '@/shared/ui';
import { colors, radii, spacing } from '@/theme';

/** Monta a logística apenas quando existe transporte ou autorização para escolher a modalidade. */
export function ReturnDelivery(props) {
  if (!props.request.delivery && !props.request.allowed_actions?.includes('CHOOSE_DELIVERY_METHOD'))
    return null;
  return <DeliveryDetails {...props} />;
}

/** Consulta os detalhes operacionais separadamente, preservando o estado oficial da devolução. */
function DeliveryDetails({ token, request, disabled, onBusy, onRefresh }) {
  const loader = useCallback(
    () => (request.delivery ? getReturnDelivery(token, request.id) : Promise.resolve(null)),
    [token, request.id, request.delivery],
  );
  const query = useApiQuery(loader);
  const delivery = query.data;
  // Apresenta a recusa como relato pendente de análise, sem atribuir culpa ao Cliente.
  const refusalReported =
    delivery?.status === 'PICKUP_FAILED' && delivery?.failure_reason === 'CLIENT_REFUSED';
  const [editingCorrection, setEditingCorrection] = useState(false);
  const [correctionNotice, setCorrectionNotice] = useState('');
  const refreshDelivery = query.refresh;
  const awaitsCorrectionDecision =
    delivery?.status === 'PICKUP_FAILED' && delivery?.failure_reason === 'ADDRESS_NOT_FOUND';
  // Só consulta periodicamente esta pendência, com o ecrã visível e sem interromper um formulário.
  useFocusEffect(
    useCallback(() => {
      if (!awaitsCorrectionDecision || disabled || editingCorrection) return;
      const refreshIfIdle = () => {
        if (AppState.currentState === 'active') refreshDelivery();
      };
      const timer = setInterval(refreshIfIdle, 30000);
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') refreshIfIdle();
      });
      return () => {
        clearInterval(timer);
        subscription.remove();
      };
    }, [awaitsCorrectionDecision, disabled, editingCorrection, refreshDelivery]),
  );
  const canChoose =
    request.status === 'AWAITING_RETURN' &&
    (request.allowed_actions?.includes('CHOOSE_DELIVERY_METHOD') ||
      delivery?.allowed_actions?.includes('SELECT_RETURN_METHOD'));
  return (
    <ReturnDetailPanel title="Como devolver o produto" icon="cube-outline">
      {correctionNotice ? (
        <AppText accessibilityRole="alert" color="primary">
          {correctionNotice}
        </AppText>
      ) : null}
      <ReturnFeedback {...query} onRetry={query.refresh} />
      {delivery ? (
        <>
          {/* A modalidade, o estado e a orientação têm hierarquia própria antes das moradas. */}
          <View style={styles.overview}>
            <AppText variant="bodyStrong">
              {delivery.method === 'STORE_DROPOFF'
                ? 'Entrega na loja'
                : 'Recolha por transportadora'}
            </AppText>
            <Badge label={returnDeliveryStatus(delivery.status)} variant="info" />
            {delivery.workflow?.message ? (
              <View style={refusalReported ? styles.inset : undefined}>
                {refusalReported ? (
                  <AppText variant="bodyStrong" color="primary">
                    Recolha por esclarecer
                  </AppText>
                ) : null}
                <AppText color="muted" style={styles.description}>
                  {delivery.workflow.message}
                </AppText>
              </View>
            ) : null}
          </View>
          {canCorrectPickupAddress(delivery) ? (
            <PickupAddressCorrection
              token={token}
              request={request}
              delivery={delivery}
              disabled={disabled}
              onBusy={onBusy}
              onEditing={setEditingCorrection}
              onRefresh={() => {
                setEditingCorrection(false);
                query.refresh();
              }}
              onCorrected={() => {
                setEditingCorrection(false);
                setCorrectionNotice('Morada enviada ao Centro. Aguarda reagendamento da recolha.');
                query.refresh();
              }}
            />
          ) : null}
          {delivery.destination?.store?.name ? (
            <View style={styles.address}>
              <AppText variant="caption" color="muted">
                Loja de destino
              </AppText>
              <AppText variant="bodyStrong">{delivery.destination.store.name}</AppText>
              {delivery.destination.address?.address ? (
                <AppText color="muted">{delivery.destination.address.address}</AppText>
              ) : null}
            </View>
          ) : null}
          {delivery.pickup_address?.address ? (
            <View style={styles.address}>
              <AppText variant="caption" color="muted">
                Morada de recolha
              </AppText>
              <AppText>{delivery.pickup_address.address}</AppText>
              {delivery.pickup_address.phone ? (
                <AppText color="muted">{delivery.pickup_address.phone}</AppText>
              ) : null}
            </View>
          ) : null}
          <DeliveryCode
            token={token}
            request={request}
            delivery={delivery}
            disabled={disabled}
            onBusy={onBusy}
            onRefresh={onRefresh}
          />
          {delivery.timeline?.length ? (
            <View style={styles.history}>
              <AppText variant="bodyStrong">Acompanhamento</AppText>
              <ReturnDetailHistory events={delivery.timeline} label={returnDeliveryStatus} />
            </View>
          ) : null}
        </>
      ) : null}
      {!query.isLoading && !query.error && canChoose ? (
        <DeliveryChoice
          token={token}
          request={request}
          delivery={delivery}
          disabled={disabled}
          onBusy={onBusy}
          onRefresh={onRefresh}
        />
      ) : null}
    </ReturnDetailPanel>
  );
}

/** Reutiliza as moradas da conta; nenhuma morada de outro Cliente é enviada pela interface. */
function PickupAddress({ token, value, onChange, disabled }) {
  const loader = useCallback(() => getAddresses(token), [token]);
  const query = useApiQuery(loader);
  return (
    <>
      <ReturnFeedback {...query} onRetry={query.refresh} />
      {query.data ? (
        <>
          <Select
            label="Morada de recolha"
            value={value}
            onChange={onChange}
            disabled={disabled}
            placeholder="Escolha a morada"
            options={query.data.map((address) => ({
              value: String(address.id),
              label: `${address.address} · ${address.municipality?.name || ''}`,
            }))}
          />
          {!query.data.length ? (
            <AppText color="muted">
              Ainda não tem moradas guardadas na conta. Pode optar pela entrega na loja.
            </AppText>
          ) : null}
        </>
      ) : null}
    </>
  );
}

/** Confirma uma única escolha; uma resposta incerta exige consulta antes de nova tentativa. */
function DeliveryChoice({ token, request, delivery, disabled, onBusy, onRefresh }) {
  const [method, setMethod] = useState('');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unknown, setUnknown] = useState(false);
  const lock = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  /** Deixa a API revalidar estado e propriedade, sem repetir automaticamente o POST. */
  async function submit() {
    if (lock.current || disabled || unknown) return;
    lock.current = true;
    setBusy(true);
    onBusy(true);
    setError('');
    try {
      await chooseReturnDelivery(token, request, delivery, method, address);
      if (active.current) onRefresh();
    } catch (failure) {
      if (active.current) {
        setUnknown(returnOutcomeUnknown(failure));
        setError(
          returnOutcomeUnknown(failure)
            ? 'Não foi possível confirmar a escolha. Atualize o pedido antes de tentar novamente.'
            : returnError(failure),
        );
      }
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
      onBusy(false);
    }
  }

  return (
    <View style={styles.history}>
      <AppText color="muted" style={styles.description}>
        Escolha como pretende entregar o artigo para análise pela loja.
      </AppText>
      <Select
        label="Modalidade de devolução"
        value={method}
        onChange={setMethod}
        disabled={busy || disabled || unknown}
        placeholder="Escolha a modalidade"
        options={[
          { value: 'STORE_DROPOFF', label: 'Entregar pessoalmente na loja' },
          { value: 'CARRIER_PICKUP', label: 'Solicitar recolha por transportadora' },
        ]}
      />
      {method === 'CARRIER_PICKUP' ? (
        <PickupAddress
          token={token}
          value={address}
          onChange={setAddress}
          disabled={busy || disabled || unknown}
        />
      ) : null}
      {error ? (
        <AppText accessibilityRole="alert" color="danger">
          {error}
        </AppText>
      ) : null}
      {unknown ? (
        <Button
          label="Consultar estado do pedido"
          onPress={onRefresh}
          disabled={busy || disabled}
          fullWidth
        />
      ) : (
        <Button
          label="Confirmar modalidade"
          onPress={submit}
          loading={busy}
          disabled={disabled || !method || (method === 'CARRIER_PICKUP' && !address)}
          fullWidth
        />
      )}
    </View>
  );
}

/** Mantém o código apenas na memória e oculta-o quando a aplicação deixa de estar ativa. */
function DeliveryCode({ token, request, delivery, disabled, onBusy, onRefresh }) {
  const [code, setCode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  // Uma resposta tardia não deve repor um código ocultado ao sair da aplicação.
  const generation = useRef(0);
  const lock = useRef(false);
  const active = useRef(true);
  const kind =
    request.status !== 'AWAITING_RETURN'
      ? null
      : delivery.allowed_actions?.includes('ISSUE_DROPOFF_CODE')
        ? 'dropoff'
        : delivery.allowed_actions?.includes('ISSUE_PICKUP_CODE')
          ? 'pickup'
          : null;
  useEffect(() => {
    active.current = true;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        generation.current += 1;
        setCode(null);
      }
    });
    return () => {
      active.current = false;
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    if (!code) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [code]);

  /** Só gera por toque e informa que uma nova emissão substitui o código anterior. */
  async function generate() {
    if (lock.current || disabled || !kind) return;
    const issuedGeneration = generation.current;
    lock.current = true;
    setBusy(true);
    onBusy(true);
    setCode(null);
    setError('');
    try {
      const result = await issueReturnDeliveryCode(token, request, delivery, kind);
      if (active.current && generation.current === issuedGeneration) {
        setNow(Date.now());
        setCode(result);
      }
    } catch (failure) {
      if (active.current) setError(returnError(failure));
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
      onBusy(false);
    }
  }

  if (!kind) return null;
  const seconds = code ? Math.max(0, Math.ceil((code.deadline - now) / 1000)) : 0;
  return (
    <View style={styles.inset}>
      <AppText variant="bodyStrong">
        {kind === 'dropoff' ? 'Confirmação na loja' : 'Autorizar a recolha'}
      </AppText>
      <AppText color="muted">
        {kind === 'dropoff'
          ? 'Apresente o código apenas quando entregar o artigo na loja.'
          : 'Partilhe o código com o entregador apenas quando entregar o artigo.'}{' '}
        Gerar outro código invalida o anterior.
      </AppText>
      {code && seconds > 0 ? (
        <>
          <AppText selectable style={styles.code}>
            {code.confirmation_code}
          </AppText>
          <AppText variant="caption" color="muted">
            Válido durante {seconds} segundos.
          </AppText>
        </>
      ) : null}
      {code && seconds === 0 ? (
        <AppText color="muted">Código expirado. Pode gerar outro.</AppText>
      ) : null}
      {error ? (
        <AppText accessibilityRole="alert" color="danger">
          {error}
        </AppText>
      ) : null}
      <Button
        label={code ? 'Gerar outro código' : 'Gerar código'}
        onPress={generate}
        loading={busy}
        disabled={disabled}
        fullWidth
      />
      <Button
        label="Atualizar acompanhamento"
        variant="outline"
        onPress={onRefresh}
        disabled={busy || disabled}
        fullWidth
      />
    </View>
  );
}

// Uma coluna, separadores discretos e código centralizado evitam competir com o histórico da conversa.
const styles = StyleSheet.create({
  inset: {
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
  },
  history: { gap: spacing.md },
  // As moradas usam superfícies neutras; o código recebe o destaque da próxima ação.
  overview: { gap: spacing.sm },
  address: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.background,
  },
  description: { fontSize: 14, lineHeight: 21 },
  code: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: 4,
    textAlign: 'center',
    color: colors.primary,
    paddingVertical: spacing.sm,
    fontVariant: ['tabular-nums'],
  },
});
