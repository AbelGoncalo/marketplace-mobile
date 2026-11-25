import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import {
  ReturnAccess,
  ReturnFeedback,
  ReturnLayout,
  ReturnPagination,
  ReturnPanel,
  useReturnRefresh,
} from '@/features/returns/components/ReturnLayout';
import { ReturnProduct } from '@/features/returns/components/ReturnProduct';
import { getReturns } from '@/features/returns/services/returnsApi';
import { returnStatus } from '@/features/returns/services/returnPresentation';
import { orderDate } from '@/features/orders/utils/orderPresentation';
import { useApiQuery } from '@/shared/hooks/useApiQuery';
import { AppText, Badge, Button } from '@/shared/ui';

/** Isola pedidos privados quando o Cliente muda de conta. */
export function ReturnsScreen() {
  return (
    <ReturnAccess>
      {(session) => <ReturnsList key={session.token} token={session.token} />}
    </ReturnAccess>
  );
}

/** Lista pedidos com paginação e acesso claro ao pedido de nova devolução. */
function ReturnsList({ token }) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const loader = useCallback(() => getReturns(token, page), [token, page]);
  const query = useApiQuery(loader);
  useReturnRefresh(query.refresh);
  const requests = query.data?.data || [];
  return (
    <ReturnLayout
      scrollKey={page}
      title="As minhas devoluções"
      subtitle="Consulte o estado dos seus pedidos."
      backTo="/(customer)/(tabs)/profile"
      onRefresh={query.refresh}
      busy={query.isLoading}
    >
      <Button
        label="Solicitar devolução"
        onPress={() => router.push('/(customer)/returns/new')}
        fullWidth
      />
      <ReturnFeedback
        {...query}
        empty={Boolean(query.data && !requests.length)}
        onRetry={query.refresh}
      />
      {requests.map((request) => {
        const state = returnStatus(request.status);
        return (
          <ReturnPanel key={request.id}>
            <Badge {...state} />
            <ReturnProduct product={request.item?.product_snapshot} store={request.store?.name}>
              <AppText variant="caption" color="muted">
                {request.quantity} unidade(s) · {orderDate(request.requested_at)}
              </AppText>
            </ReturnProduct>
            <AppText variant="caption" color="muted" selectable>
              {request.reference}
            </AppText>
            <Button
              label="Ver pedido"
              variant="outline"
              onPress={() =>
                router.push({ pathname: '/(customer)/returns/[id]', params: { id: request.id } })
              }
              fullWidth
            />
          </ReturnPanel>
        );
      })}
      {query.data ? <ReturnPagination page={page} data={query.data} onPage={setPage} /> : null}
    </ReturnLayout>
  );
}
