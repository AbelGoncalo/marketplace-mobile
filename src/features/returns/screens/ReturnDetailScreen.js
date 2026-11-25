import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { routeValue } from '@/features/catalog/utils/productPresentation';
import {
  ReturnSummary,
  ReturnDecision,
  ReturnProductDetails,
  ReturnDetailPanel,
  ReturnDetailHistory,
} from '@/features/returns/components/ReturnDetailCards';
import {
  ReturnAccess,
  ReturnFeedback,
  ReturnLayout,
  ReturnPanel,
  useReturnRefresh,
} from '@/features/returns/components/ReturnLayout';
import { ReturnAttachments } from '@/features/returns/components/ReturnAttachments';
import { ReturnConversation } from '@/features/returns/components/ReturnConversation';
import { ReturnDelivery } from '@/features/returns/components/ReturnDelivery';
import {
  cancelReturn,
  getReturn,
  returnError,
  returnOutcomeUnknown,
} from '@/features/returns/services/returnsApi';
import { useApiQuery } from '@/shared/hooks/useApiQuery';
import { AppText, Button, Input } from '@/shared/ui';

/** Valida a referência na camada de serviço e desmonta dados ao mudar de conta ou pedido. */
export function ReturnDetailScreen() {
  const params = useLocalSearchParams();
  const id = routeValue(params.id);
  return (
    <ReturnAccess>
      {(session) => <ReturnDetail key={`${session.token}-${id}`} token={session.token} id={id} />}
    </ReturnAccess>
  );
}

/** Mostra o estado real, a decisão e o histórico sem inferir aprovação de reembolso. */
function ReturnDetail({ token, id }) {
  const loader = useCallback(() => getReturn(token, id), [token, id]);
  const query = useApiQuery(loader);
  useReturnRefresh(query.refresh);
  const request = query.data;
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [conversationBusy, setConversationBusy] = useState(false);
  // Impede atualizar o detalhe durante uma confirmação logística em curso.
  const [deliveryBusy, setDeliveryBusy] = useState(false);

  /** Após cancelar, volta a consultar para retirar ações que deixaram de estar disponíveis. */
  function cancelled() {
    setNotice('O pedido de devolução foi cancelado.');
    query.refresh();
  }

  return (
    <ReturnLayout
      title="Detalhe da devolução"
      subtitle="Acompanhe a análise e as instruções."
      onRefresh={query.refresh}
      busy={busy || conversationBusy || deliveryBusy || query.isLoading}
    >
      {notice ? (
        <ReturnPanel>
          <AppText accessibilityRole="alert" color="primary">
            {notice}
          </AppText>
        </ReturnPanel>
      ) : null}
      <ReturnFeedback {...query} onRetry={query.refresh} />
      {request ? (
        <>
          <ReturnSummary request={request} />
          {/* A decisão e as instruções surgem antes das ações e dos dados de consulta. */}
          <ReturnDecision decision={request.decision} />
          <ReturnDelivery
            token={token}
            request={request}
            disabled={busy || conversationBusy}
            onBusy={setDeliveryBusy}
            onRefresh={query.refresh}
          />
          <ReturnConversation
            token={token}
            request={request}
            onBusy={setConversationBusy}
            disabled={busy || deliveryBusy}
            onStatusRefresh={query.refresh}
          />
          {/* Produto e anexos ficam juntos como informação de consulta, depois da conversa. */}
          <ReturnProductDetails request={request} />
          <ReturnAttachments key={request.id} token={token} attachments={request.attachments} />
          {request.timeline?.length ? (
            <ReturnDetailPanel title="Histórico do pedido" icon="time-outline">
              <ReturnDetailHistory events={request.timeline} />
            </ReturnDetailPanel>
          ) : null}
          {request.allowed_actions?.includes('CANCEL') ? (
            <ReturnCancellation
              token={token}
              request={request}
              onCancelled={cancelled}
              onRefresh={query.refresh}
              onBusy={setBusy}
              disabled={conversationBusy || deliveryBusy}
            />
          ) : null}
        </>
      ) : null}
    </ReturnLayout>
  );
}

/** Exige confirmação e motivo, com bloqueio imediato e recuperação por consulta em caso de dúvida. */
function ReturnCancellation({ token, request, onCancelled, onRefresh, onBusy, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unknown, setUnknown] = useState(false);
  const locked = useRef(false);
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  /** Revalida a permissão através da API e não repete automaticamente o cancelamento. */
  async function submit() {
    if (locked.current || unknown || disabled) return;
    locked.current = true;
    setBusy(true);
    onBusy(true);
    setError('');
    try {
      await cancelReturn(token, request, reason);
      if (active.current) onCancelled();
    } catch (failure) {
      if (active.current) {
        const uncertain = returnOutcomeUnknown(failure);
        setUnknown(uncertain);
        setError(
          uncertain
            ? 'Não foi possível confirmar o resultado. Atualize o pedido para consultar o estado antes de tentar novamente.'
            : returnError(failure),
        );
      }
    } finally {
      locked.current = false;
      if (active.current) setBusy(false);
      onBusy(false);
    }
  }

  return (
    <ReturnDetailPanel title="Cancelar pedido" icon="close-circle-outline">
      <AppText color="muted">Pode cancelar enquanto o pedido ainda aguarda análise.</AppText>
      {!open ? (
        <Button
          label="Cancelar pedido"
          variant="outline"
          disabled={disabled}
          onPress={() => setOpen(true)}
          fullWidth
        />
      ) : (
        <>
          <Input
            label="Motivo do cancelamento"
            value={reason}
            onChangeText={setReason}
            multiline
            maxLength={1000}
            editable={!busy && !unknown && !disabled}
            helperText="Entre 5 e 1000 caracteres."
          />
          {error ? (
            <AppText accessibilityRole="alert" color="danger">
              {error}
            </AppText>
          ) : null}
          {unknown ? (
            <Button
              label="Atualizar estado do pedido"
              variant="outline"
              onPress={onRefresh}
              disabled={disabled || busy}
              fullWidth
            />
          ) : (
            <>
              <Button
                label="Confirmar cancelamento"
                variant="danger"
                onPress={submit}
                loading={busy}
                disabled={disabled}
                fullWidth
              />
              <Button
                label="Manter pedido"
                variant="outline"
                onPress={() => {
                  setOpen(false);
                  setError('');
                }}
                disabled={busy || disabled}
                fullWidth
              />
            </>
          )}
        </>
      )}
    </ReturnDetailPanel>
  );
}
