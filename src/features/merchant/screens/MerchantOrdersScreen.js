import {
  MerchantOrderFilters,
  MerchantOrderCard,
  MerchantOrderSummary,
  MerchantOrderCustomer,
  MerchantActionPanel,
  MerchantOrderProducts,
  MerchantOrderTotals,
  MerchantOrderHistory,
} from '@/features/merchant/components/MerchantOrderCards';
import { PickupActions } from '@/features/delivery/components/PickupActions';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { routeValue } from '@/features/catalog/utils/productPresentation';
import {
  getMerchantOrders,
  getMerchantOrder,
  prepareMerchantOrder,
  merchantHandover,
  confirmCustomerPickup,
} from '@/features/merchant/services/merchantOrdersApi';
import {
  ReturnLayout,
  ReturnFeedback,
  ReturnPagination,
  useReturnRefresh,
} from '@/features/returns/components/ReturnLayout';
import { useApiQuery } from '@/shared/hooks/useApiQuery';
import { AppText, Button } from '@/shared/ui';
import { orderDate } from '@/features/orders/utils/orderPresentation';

/** Complementa a proteção do grupo com a permissão específica e isola a troca de conta. */
function MerchantOrdersAccess({ children }) {
  const { session } = useAuth();
  if (!session?.user.permissions.includes('supplier-orders.view'))
    return (
      <ReturnLayout title="Encomendas" backTo="/(merchant)/merchant">
        <AppText>Não tem permissão para consultar encomendas.</AppText>
      </ReturnLayout>
    );
  return children(session);
}
/** Monta a lista privada apenas para a sessão autorizada. */
export function MerchantOrdersScreen() {
  return (
    <MerchantOrdersAccess>
      {(session) => <OrdersList key={session.token} token={session.token} />}
    </MerchantOrdersAccess>
  );
}
/** Lista por estado e página, atualizando ao regressar do detalhe. */
function OrdersList({ token }) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const loader = useCallback(() => getMerchantOrders(token, page, status), [token, page, status]);
  const query = useApiQuery(loader);
  useReturnRefresh(query.refresh);
  return (
    <ReturnLayout
      title="Encomendas"
      subtitle="Prepare os pedidos das suas lojas."
      backTo="/(merchant)/merchant"
      onRefresh={query.refresh}
      busy={query.isLoading}
      refreshLabel="Atualizar encomendas"
      scrollKey={`${page}-${status}`}
    >
      <MerchantOrderFilters
        value={status}
        onChange={(value) => {
          setStatus(value);
          setPage(1);
        }}
      />
      <ReturnFeedback
        {...query}
        loadingText="A consultar encomendas..."
        empty={Boolean(query.data && !query.data.data.length)}
        emptyText="Sem encomendas neste estado."
        onRetry={query.refresh}
      />
      {(query.data?.data || []).map((order) => (
        <MerchantOrderCard
          key={order.id}
          order={order}
          onPress={() =>
            router.push({ pathname: '/(merchant)/merchant/orders/[id]', params: { id: order.id } })
          }
        />
      ))}
      {query.data ? <ReturnPagination page={page} data={query.data} onPage={setPage} /> : null}
    </ReturnLayout>
  );
}
/** Liga o identificador ao detalhe privado da sessão atual. */
export function MerchantOrderDetailScreen() {
  const params = useLocalSearchParams();
  const id = routeValue(params.id);
  return (
    <MerchantOrdersAccess>
      {(session) => (
        <OrderDetail
          key={`${session.token}-${id}`}
          token={session.token}
          id={id}
          permissions={session.user.permissions}
        />
      )}
    </MerchantOrdersAccess>
  );
}
/** Separa preparação, passagem ao entregador, produtos e histórico. */
function OrderDetail({ token, id, permissions }) {
  const loader = useCallback(() => getMerchantOrder(token, id), [token, id]);
  const query = useApiQuery(loader);
  useReturnRefresh(query.refresh);
  const [busy, setBusy] = useState(false);
  const order = query.data;
  /** Mantém visível uma única operação: preparação, passagem ou levantamento presencial. */
  const canFulfill = permissions.includes('supplier-orders.fulfillment');
  const hasHandover = Boolean(
    order?.allowed_actions?.some((action) =>
      ['CONFIRM_HANDOVER', 'REGENERATE_PICKUP_CODE'].includes(action),
    ),
  );
  const showCustomerPickup =
    canFulfill && Boolean(order?.allowed_actions?.includes('CONFIRM_CUSTOMER_PICKUP'));
  const showHandover = canFulfill && hasHandover;
  const showPreparation = (!hasHandover || !canFulfill) && !showCustomerPickup;
  return (
    <ReturnLayout
      title="Detalhe da encomenda"
      backTo="/(merchant)/merchant/orders"
      onRefresh={query.refresh}
      busy={busy || query.isLoading}
      refreshLabel="Atualizar encomenda"
    >
      <ReturnFeedback {...query} loadingText="A consultar encomenda..." onRetry={query.refresh} />
      {order ? (
        <>
          <MerchantOrderSummary order={order} />
          {showPreparation ? (
            <PreparationActions
              token={token}
              order={order}
              permissions={permissions}
              onRefresh={query.refresh}
              onBusy={setBusy}
            />
          ) : null}
          {showCustomerPickup ? (
            <PickupActions
              title="Levantamento pelo cliente"
              Panel={MerchantActionPanel}
              hint="Peça ao Cliente o código de seis algarismos da compra e valide-o para concluir o levantamento."
              needsCode
              actions={[
                {
                  action: 'CONFIRM_CUSTOMER_PICKUP',
                  label: 'Confirmar levantamento',
                  confirmation: 'O Cliente está presente e apresenta o código de levantamento?',
                },
              ]}
              execute={(action, code) => confirmCustomerPickup(token, order, code, permissions)}
              onRefresh={query.refresh}
              onBusy={setBusy}
            />
          ) : null}
          {showHandover ? (
            <PickupActions
              title={
                order.allowed_actions.includes('CONFIRM_HANDOVER')
                  ? 'Entregar ao entregador'
                  : 'Código de recolha'
              }
              Panel={MerchantActionPanel}
              hint={
                order.allowed_actions.includes('CONFIRM_HANDOVER')
                  ? 'O Entregador iniciou a recolha. Entregue-lhe o pacote e confirme primeiro a passagem física; depois ele poderá validar o código.'
                  : 'A passagem física já foi confirmada. Apresente o código ao Entregador para ele concluir a recolha.'
              }
              issuedHint="Apresente este código somente ao Entregador atribuído."
              issuedNotice={
                order.allowed_actions.includes('CONFIRM_HANDOVER')
                  ? 'Antes da validação, confirme a entrega física do pacote ao Entregador.'
                  : 'A passagem já está confirmada. O Entregador pode introduzir este código.'
              }
              actions={[
                {
                  action: 'CONFIRM_HANDOVER',
                  label: 'Confirmar entrega ao entregador',
                  confirmation: 'Já entregou fisicamente o pacote ao entregador atribuído?',
                },
                {
                  action: 'REGENERATE_PICKUP_CODE',
                  label: 'Gerar novo código de recolha',
                  confirmation: 'Gerar um código temporário e invalidar o anterior?',
                  secondary: true,
                },
              ].filter((entry) => order.allowed_actions.includes(entry.action))}
              execute={(action) => merchantHandover(token, order, action, permissions)}
              onRefresh={query.refresh}
              onBusy={setBusy}
            />
          ) : null}
          <MerchantOrderCustomer order={order} />
          <MerchantOrderProducts order={order} />
          <MerchantOrderTotals order={order} />
          <MerchantOrderHistory order={order} />
        </>
      ) : null}
    </ReturnLayout>
  );
}
/** Exige confirmação explícita e consulta o estado depois de respostas incertas. */
function PreparationActions({ token, order, permissions, onRefresh, onBusy }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unknown, setUnknown] = useState(false);
  const [issued, setIssued] = useState(null);
  const lock = useRef(false);
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const action = order.allowed_actions?.includes('START_PREPARATION')
    ? 'START_PREPARATION'
    : order.allowed_actions?.includes('MARK_READY_FOR_PICKUP')
      ? 'MARK_READY_FOR_PICKUP'
      : null;
  const allowed = permissions.includes('supplier-orders.fulfillment');
  const label = action === 'START_PREPARATION' ? 'Iniciar preparação' : 'Marcar como pronta';

  /** Um toque confirmado corresponde a uma transição, sem repetição automática de PATCH. */
  async function submit() {
    if (lock.current || unknown) return;
    lock.current = true;
    setBusy(true);
    onBusy(true);
    setError('');
    try {
      const result = await prepareMerchantOrder(token, order, action, permissions);
      if (active.current) {
        if (result?.pickup_confirmation?.pickup_code) {
          setIssued(result.pickup_confirmation);
          setConfirming(false);
        } else onRefresh();
      }
    } catch (failure) {
      if (active.current) {
        const uncertain = failure.status === 0 || failure.status >= 500;
        setUnknown(uncertain);
        setError(
          uncertain
            ? 'Não foi possível confirmar a alteração. Consulte o estado antes de repetir.'
            : failure.message,
        );
      }
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
      onBusy(false);
    }
  }
  return (
    <MerchantActionPanel title={action ? 'Preparação da encomenda' : 'Acompanhamento'}>
      {issued ? (
        <>
          <AppText color="muted">
            A encomenda está pronta. Este código será validado pelo Entregador no momento da
            recolha.
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
          <AppText variant="bodyStrong" color="primary">
            Quando o Entregador chegar, confirme primeiro a passagem física do pacote. Só depois ele
            deverá introduzir este código.
          </AppText>
          <AppText variant="caption" color="muted">
            O código fica visível apenas neste ecrã. Se precisar, poderá gerar um novo quando o
            Entregador estiver presente.
          </AppText>
          <Button
            label="Concluir e atualizar"
            fullWidth
            onPress={() => {
              setIssued(null);
              onRefresh();
            }}
          />
        </>
      ) : !action ? (
        <AppText color="muted">
          {order.fulfillment_status === 'READY_FOR_PICKUP'
            ? 'Pedido pronto. Aguarda recolha ou levantamento.'
            : 'Não há ações de preparação disponíveis neste estado.'}
        </AppText>
      ) : !allowed ? (
        <AppText color="muted">Não tem permissão para alterar a preparação.</AppText>
      ) : (
        <>
          <AppText color="muted">
            {action === 'START_PREPARATION'
              ? 'Confirme que vai iniciar a separação dos produtos.'
              : 'Confirme que todos os produtos estão separados e embalados.'}
          </AppText>
          {error ? (
            <AppText accessibilityRole="alert" color="danger">
              {error}
            </AppText>
          ) : null}
          {unknown ? (
            <Button label="Consultar estado" fullWidth onPress={onRefresh} disabled={busy} />
          ) : !confirming ? (
            <Button label={label} fullWidth onPress={() => setConfirming(true)} />
          ) : (
            <>
              <Button label="Confirmar" fullWidth loading={busy} onPress={submit} />
              <Button
                label="Voltar"
                variant="outline"
                fullWidth
                disabled={busy}
                onPress={() => setConfirming(false)}
              />
            </>
          )}
        </>
      )}
    </MerchantActionPanel>
  );
}
