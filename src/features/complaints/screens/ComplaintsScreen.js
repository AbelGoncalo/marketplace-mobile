import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { ComplaintDecision } from '@/features/complaints/components/ComplaintDecision';
import { routeValue } from '@/features/catalog/utils/productPresentation';
import {
  ComplaintAccess,
  ComplaintFeedback,
  ComplaintLayout,
  useComplaintMutation,
} from '@/features/complaints/components/ComplaintLayout';
import {
  cancelComplaint,
  complaintStatus,
  complaintTypes,
  getComplaints,
} from '@/features/complaints/services/complaintsApi';
import { useComplaintDetail } from '@/features/complaints/hooks/useComplaintDetail';
import { complaintConversation } from '@/features/complaints/services/complaintMessagesApi';
import { ReturnConversation } from '@/features/returns/components/ReturnConversation';
import { orderDate } from '@/features/orders/utils/orderPresentation';
import {
  ReturnDetailHistory,
  ReturnDetailPanel,
} from '@/features/returns/components/ReturnDetailCards';
import {
  ReturnPanel,
  ReturnPagination,
  useReturnRefresh,
} from '@/features/returns/components/ReturnLayout';
import { ReturnProduct } from '@/features/returns/components/ReturnProduct';
import { useApiQuery } from '@/shared/hooks/useApiQuery';
import { AppText, Badge, Button, Input } from '@/shared/ui';

/** Desmonta a listagem privada quando a conta muda. */
export function ComplaintsScreen() {
  return (
    <ComplaintAccess>
      {(session) => <ComplaintsList key={session.token} token={session.token} />}
    </ComplaintAccess>
  );
}

/** Lista processos paginados e encaminha a abertura para uma compra pertencente ao Cliente. */
function ComplaintsList({ token }) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const loader = useCallback(() => getComplaints(token, page), [token, page]);
  const query = useApiQuery(loader);
  useReturnRefresh(query.refresh);
  const complaints = query.data?.data || [];
  return (
    <ComplaintLayout
      title="As minhas reclamações"
      subtitle="Acompanhe a resposta aos seus pedidos."
      backTo="/(customer)/(tabs)/profile"
      onRefresh={query.refresh}
      busy={query.isLoading}
      scrollKey={page}
    >
      <Button
        label="Escolher compra para reclamar"
        variant="outline"
        fullWidth
        onPress={() =>
          router.push({ pathname: '/(customer)/orders', params: { purpose: 'complaint' } })
        }
      />
      <ComplaintFeedback
        {...query}
        onRetry={query.refresh}
        empty={Boolean(query.data && !complaints.length)}
      />
      {complaints.map((complaint) => (
        <ReturnPanel key={complaint.id}>
          <Badge {...complaintStatus(complaint.status)} />
          <AppText variant="heading3">{complaint.subject}</AppText>
          {complaint.store?.name ? <AppText color="muted">{complaint.store.name}</AppText> : null}
          <AppText variant="caption" color="muted">
            {orderDate(complaint.created_at)}
          </AppText>
          <AppText variant="caption" color="muted" selectable>
            {complaint.reference}
          </AppText>
          <Button
            label="Ver reclamação"
            variant="outline"
            fullWidth
            onPress={() =>
              router.push({ pathname: '/(customer)/complaints/[id]', params: { id: complaint.id } })
            }
          />
        </ReturnPanel>
      ))}
      {query.data ? <ReturnPagination page={page} data={query.data} onPage={setPage} /> : null}
    </ComplaintLayout>
  );
}

/** Isola a consulta do detalhe por conta e identificador. */
export function ComplaintDetailScreen() {
  const params = useLocalSearchParams();
  const id = routeValue(params.id);
  return (
    <ComplaintAccess>
      {(session) => (
        <ComplaintDetail key={`${session.token}-${id}`} token={session.token} id={id} />
      )}
    </ComplaintAccess>
  );
}

/** Mantém estado e conversa sincronizados sem apagar o rascunho durante consultas periódicas. */
function ComplaintDetail({ token, id }) {
  const [cancelling, setCancelling] = useState(false);
  const [sending, setSending] = useState(false);
  const query = useComplaintDetail(token, id, cancelling || sending);
  const complaint = query.data;
  return (
    <ComplaintLayout
      title="Detalhe da reclamação"
      subtitle="Consulte o estado e o histórico."
      onRefresh={query.refresh}
      busy={query.isLoading || query.isRefreshing || cancelling || sending}
    >
      <ComplaintFeedback {...query} onRetry={query.refresh} />
      {complaint ? (
        <>
          <ReturnPanel>
            <Badge {...complaintStatus(complaint.status)} />
            <AppText variant="heading3">{complaint.subject}</AppText>
            <AppText variant="caption" color="muted" selectable>
              {complaint.reference}
            </AppText>
            <AppText variant="caption" color="muted">
              Aberta em {orderDate(complaint.created_at)}
            </AppText>
          </ReturnPanel>
          {/* O desfecho surge antes dos dados enviados e do histórico para facilitar a consulta. */}
          <ComplaintDecision complaint={complaint} />
          <ReturnDetailPanel title="Situação reportada" icon="document-text-outline">
            <AppText variant="caption" color="muted">
              Categoria
            </AppText>
            <AppText variant="bodyStrong">
              {complaintTypes.find((type) => type.value === complaint.type)?.label ||
                'Em atualização'}
            </AppText>
            <AppText>{complaint.description}</AppText>
          </ReturnDetailPanel>
          <ReturnDetailPanel title="Compra de origem" icon="bag-handle-outline">
            {complaint.order_item || complaint.item ? (
              <ReturnProduct
                product={complaint.order_item?.product_snapshot || complaint.item?.product}
                store={complaint.store?.name}
              />
            ) : (
              <AppText>{complaint.store?.name || 'Encomenda da compra'}</AppText>
            )}
            <AppText variant="caption" color="muted" selectable>
              {complaint.order?.reference}
            </AppText>
          </ReturnDetailPanel>
          {/* A escrita só aparece quando o Centro aguarda informação; histórico e anexos mantêm-se. */}
          <ReturnConversation
            token={token}
            request={complaint}
            conversation={complaintConversation}
            onBusy={setSending}
            disabled={cancelling || !query.verified || query.isRefreshing}
            onStatusRefresh={() => query.refresh(true)}
          />
          {complaint.timeline?.length ? (
            <ReturnDetailPanel title="Histórico da reclamação" icon="time-outline">
              <ReturnDetailHistory
                events={complaint.timeline}
                label={(status) => complaintStatus(status).label}
              />
            </ReturnDetailPanel>
          ) : null}
          {complaint.status === 'OPEN' && complaint.allowed_actions?.includes('CANCEL') ? (
            <ComplaintCancellation
              token={token}
              complaint={complaint}
              onRefresh={() => query.refresh(true)}
              onBusy={setCancelling}
              disabled={sending || !query.verified || query.isRefreshing}
            />
          ) : null}
        </>
      ) : null}
    </ComplaintLayout>
  );
}

/** Exige confirmação e motivo, e impede nova tentativa enquanto o resultado não for consultado. */
function ComplaintCancellation({ token, complaint, onRefresh, onBusy, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const mutation = useComplaintMutation();

  /** Propaga o bloqueio ao cabeçalho até terminar a operação, mesmo em caso de falha. */
  function cancel() {
    if (disabled) return;
    return mutation.run(() => cancelComplaint(token, complaint, reason), onRefresh, onBusy);
  }

  return (
    <ReturnDetailPanel title="Cancelar reclamação" icon="close-circle-outline">
      <AppText color="muted">Pode cancelar enquanto a reclamação ainda aguarda análise.</AppText>
      {!open ? (
        <Button
          label="Cancelar reclamação"
          variant="outline"
          fullWidth
          disabled={disabled}
          onPress={() => setOpen(true)}
        />
      ) : (
        <>
          <Input
            label="Motivo do cancelamento"
            value={reason}
            onChangeText={setReason}
            multiline
            maxLength={1000}
            editable={!mutation.busy && !mutation.unknown && !disabled}
            helperText="Entre 5 e 1000 caracteres."
          />
          {mutation.error ? (
            <AppText accessibilityRole="alert" color="danger">
              {mutation.error}
            </AppText>
          ) : null}
          {mutation.unknown ? (
            <Button label="Consultar estado" onPress={onRefresh} disabled={disabled} fullWidth />
          ) : (
            <>
              <Button
                label="Confirmar cancelamento"
                variant="danger"
                fullWidth
                loading={mutation.busy}
                disabled={disabled}
                onPress={cancel}
              />
              <Button
                label="Manter reclamação"
                variant="outline"
                fullWidth
                disabled={mutation.busy || disabled}
                onPress={() => setOpen(false)}
              />
            </>
          )}
        </>
      )}
    </ReturnDetailPanel>
  );
}
