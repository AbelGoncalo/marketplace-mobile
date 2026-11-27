import { useCallback, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/features/auth/context/AuthContext';
import { routeValue } from '@/features/catalog/utils/productPresentation';
import {
  getDeliveries,
  getDelivery,
  pickupAction,
  deliveryAction,
  reportDeliveryFailure,
} from '@/features/delivery/services/deliveryApi';
import { PickupActions } from '@/features/delivery/components/PickupActions';
import { DeliveryActions } from '@/features/delivery/components/DeliveryActions';
import { DeliveryFailure } from '@/features/delivery/components/DeliveryFailure';
import {
  DeliveryActionPanel,
  DeliveryHistory,
  DeliveryListCard,
  DeliveryProducts,
  DeliveryRoute,
  DeliverySection,
  DeliverySummary,
} from '@/features/delivery/components/DeliveryCards';
import {
  ReturnLayout,
  ReturnFeedback,
  ReturnPagination,
  useReturnRefresh,
} from '@/features/returns/components/ReturnLayout';
import { useApiQuery } from '@/shared/hooks/useApiQuery';
import { AppText, Button } from '@/shared/ui';

/** Desmonta dados privados ao trocar de conta; o grupo protegido valida o tipo de utilizador. */
export function DeliveryListScreen() {
  const { session } = useAuth();
  return session ? <DeliveryList key={session.token} token={session.token} /> : null;
}
/** Lista paginada com as tarefas atribuídas, sem criar ou redistribuir entregas. */
function DeliveryList({ token }) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const loader = useCallback(() => getDeliveries(token, page), [token, page]);
  const query = useApiQuery(loader);
  useReturnRefresh(query.refresh);
  return (
    <ReturnLayout
      title="As minhas entregas"
      subtitle="Recolhas e entregas atribuídas a si."
      backTo="/(delivery)/delivery"
      onRefresh={query.refresh}
      refreshLabel="Atualizar entregas"
      busy={query.isLoading}
      scrollKey={page}
    >
      <ReturnFeedback
        {...query}
        loadingText="A consultar entregas..."
        empty={Boolean(query.data && !query.data.data.length)}
        emptyText="Ainda não tem entregas atribuídas."
        onRetry={query.refresh}
      />
      {(query.data?.data || []).map((delivery) => (
        <DeliveryListCard
          key={delivery.id}
          delivery={delivery}
          onPress={() =>
            router.push({ pathname: '/(delivery)/delivery/[id]', params: { id: delivery.id } })
          }
        />
      ))}
      {query.data ? <ReturnPagination page={page} data={query.data} onPage={setPage} /> : null}
    </ReturnLayout>
  );
}
/** Liga a referência da rota à sessão atual, sem conservar dados entre contas. */
export function DeliveryDetailScreen() {
  const { session } = useAuth();
  const params = useLocalSearchParams();
  const id = routeValue(params.id);
  return session ? (
    <DeliveryDetail key={`${session.token}-${id}`} token={session.token} id={id} />
  ) : null;
}
/** Mantém origem, destinatário, produtos e ação de recolha numa sequência simples. */
function DeliveryDetail({ token, id }) {
  const loader = useCallback(() => getDelivery(token, id), [token, id]);
  const query = useApiQuery(loader);
  useReturnRefresh(query.refresh);
  const [busy, setBusy] = useState(false);
  const delivery = query.data;
  const action = delivery?.allowed_actions?.includes('START_PICKUP')
    ? 'START_PICKUP'
    : delivery?.allowed_actions?.includes('CONFIRM_PICKUP')
      ? 'CONFIRM_PICKUP'
      : null;
  const transportAction =
    ['START_TRANSIT', 'CONFIRM_DELIVERY', 'CONFIRM_RETURN_TO_STORE'].find((candidate) =>
      delivery?.allowed_actions?.includes(candidate),
    ) ?? null;
  return (
    <ReturnLayout
      title="Detalhe da entrega"
      backTo="/(delivery)/delivery/deliveries"
      onRefresh={query.refresh}
      refreshLabel="Atualizar entrega"
      busy={busy || query.isLoading}
    >
      <ReturnFeedback {...query} loadingText="A consultar entrega..." onRetry={query.refresh} />
      {delivery ? (
        <>
          <DeliverySummary delivery={delivery} />
          {action ? (
            <PickupActions
              title="Próxima ação"
              key={action}
              actions={[
                {
                  action,
                  label: action === 'START_PICKUP' ? 'Iniciar recolha' : 'Confirmar recolha',
                  confirmation:
                    action === 'START_PICKUP'
                      ? 'Vai deslocar-se à loja para recolher esta encomenda?'
                      : 'Já recebeu o pacote e o código apresentado pelo lojista?',
                },
              ]}
              hint={
                action === 'START_PICKUP'
                  ? 'A loja marcou a encomenda como pronta.'
                  : 'Introduza o código apresentado pelo lojista no momento da recolha.'
              }
              needsCode={action === 'CONFIRM_PICKUP'}
              execute={(selected, code) => pickupAction(token, delivery, selected, code)}
              onRefresh={query.refresh}
              onBusy={setBusy}
              Panel={DeliveryActionPanel}
            />
          ) : transportAction ? (
            <DeliveryActions
              key={transportAction}
              action={transportAction}
              execute={(selected, data) => deliveryAction(token, delivery, selected, data)}
              onRefresh={query.refresh}
              onBusy={setBusy}
              Panel={DeliveryActionPanel}
            />
          ) : (
            <DeliverySection title="Acompanhamento" icon="information-circle-outline">
              <AppText color="muted">
                {delivery.operational_status === 'PICKUP_PENDING'
                  ? 'O código já foi gerado, mas o Lojista ainda precisa confirmar a passagem física do pacote. Depois dessa confirmação, atualize para introduzir o código.'
                  : delivery.operational_status === 'ASSIGNED'
                    ? 'Aguarda que a loja prepare a encomenda.'
                    : delivery.operational_status === 'DELIVERED'
                      ? 'A entrega foi concluída e não requer outras ações.'
                      : 'Não há ações disponíveis neste estado.'}
              </AppText>
              {delivery.operational_status === 'PICKUP_PENDING' ? (
                <Button
                  label="Atualizar estado"
                  fullWidth
                  variant="outline"
                  onPress={query.refresh}
                />
              ) : null}
            </DeliverySection>
          )}
          {delivery.allowed_actions?.includes('REPORT_FAILURE') ? (
            <DeliveryFailure
              key={delivery.operational_status}
              execute={(reason) => reportDeliveryFailure(token, delivery, reason)}
              onRefresh={query.refresh}
              onBusy={setBusy}
            />
          ) : null}
          <DeliveryRoute delivery={delivery} />
          <DeliveryProducts delivery={delivery} />
          <DeliveryHistory delivery={delivery} />
        </>
      ) : null}
    </ReturnLayout>
  );
}
