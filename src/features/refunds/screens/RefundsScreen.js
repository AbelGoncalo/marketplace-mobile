import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { routeValue } from '@/features/catalog/utils/productPresentation';
import { OrderAccess } from '@/features/orders/components/OrderAccess';
import { orderAmount, orderDate } from '@/features/orders/utils/orderPresentation';
import {
  ReturnFeedback,
  ReturnLayout,
  ReturnPagination,
  ReturnPanel,
  useReturnRefresh,
} from '@/features/returns/components/ReturnLayout';
import { ReturnProduct } from '@/features/returns/components/ReturnProduct';
import { getRefund, getRefunds, refundStatus } from '@/features/refunds/services/refundsApi';
import { useApiQuery } from '@/shared/hooks/useApiQuery';
import { AppText, Badge, Button } from '@/shared/ui';
import { RefundDetailContent } from '@/features/refunds/components/RefundDetailContent';

/** Reutiliza a proteção de Cliente com destino de entrada específico dos reembolsos. */
function RefundAccess({ children }) {
  return (
    <OrderAccess
      title="Os meus reembolsos"
      description="Entre para acompanhar os seus reembolsos."
      returnTo="refunds"
    >
      {children}
    </OrderAccess>
  );
}

/** Desmonta dados financeiros ao terminar sessão ou mudar de conta. */
export function RefundsScreen() {
  return (
    <RefundAccess>
      {(session) => <RefundsList key={session.token} token={session.token} />}
    </RefundAccess>
  );
}

/** Lista os processos automaticamente criados pela API, sem ações financeiras no mobile. */
function RefundsList({ token }) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const loader = useCallback(() => getRefunds(token, page), [token, page]);
  const query = useApiQuery(loader);
  useReturnRefresh(query.refresh);
  const refunds = query.data?.data || [];
  return (
    <ReturnLayout
      refreshLabel="Atualizar reembolsos"
      title="Os meus reembolsos"
      subtitle="Acompanhe o estado e o valor de cada processo."
      backTo="/(customer)/(tabs)/profile"
      onRefresh={query.refresh}
      busy={query.isLoading}
      scrollKey={page}
    >
      <ReturnFeedback
        loadingText="A consultar reembolsos..."
        {...query}
        onRetry={query.refresh}
        empty={Boolean(query.data && !refunds.length)}
        emptyText="Ainda não tem reembolsos. São criados automaticamente quando a loja aceita uma devolução após a inspeção."
      />
      {refunds.map((refund) => {
        const state = refundStatus(refund.status);
        return (
          <ReturnPanel key={refund.id}>
            <Badge label={state.label} variant={state.variant} />
            <AppText variant="heading2" color="primary">
              {orderAmount(refund.refund_amount, refund.currency)}
            </AppText>
            <ReturnProduct
              product={refund.item?.product_snapshot}
              store={refund.order?.store?.name}
            />
            <AppText variant="caption" color="muted">
              Criado em {orderDate(refund.requested_at)}
            </AppText>
            <AppText variant="caption" color="muted" selectable>
              {refund.reference}
            </AppText>
            <Button
              label="Ver reembolso"
              variant="outline"
              fullWidth
              onPress={() =>
                router.push({ pathname: '/(customer)/refunds/[id]', params: { id: refund.id } })
              }
            />
          </ReturnPanel>
        );
      })}
      {query.data ? <ReturnPagination page={page} data={query.data} onPage={setPage} /> : null}
    </ReturnLayout>
  );
}

/** Isola também o detalhe por referência, impedindo que respostas de outra conta permaneçam visíveis. */
export function RefundDetailScreen() {
  const params = useLocalSearchParams();
  const id = routeValue(params.id);
  return (
    <RefundAccess>
      {(session) => <RefundDetail key={`${session.token}-${id}`} token={session.token} id={id} />}
    </RefundAccess>
  );
}

/** Dá prioridade ao estado e valor, seguidos da decisão, origem, tentativas e histórico. */
function RefundDetail({ token, id }) {
  const router = useRouter();
  const loader = useCallback(() => getRefund(token, id), [token, id]);
  const query = useApiQuery(loader);
  useReturnRefresh(query.refresh);
  const refund = query.data;
  return (
    <ReturnLayout
      refreshLabel="Atualizar reembolsos"
      title="Detalhe do reembolso"
      subtitle="Consulte o progresso do seu processo."
      backTo="/(customer)/refunds"
      onRefresh={query.refresh}
      busy={query.isLoading}
    >
      <ReturnFeedback loadingText="A consultar reembolsos..." {...query} onRetry={query.refresh} />
      {refund ? (
        <RefundDetailContent
          refund={refund}
          onOpenReturn={() =>
            router.push({
              pathname: '/(customer)/returns/[id]',
              params: { id: refund.return_request.id },
            })
          }
        />
      ) : null}
    </ReturnLayout>
  );
}
