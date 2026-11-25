import { useCallback, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/features/auth/context/AuthContext';
import { routeValue } from '@/features/catalog/utils/productPresentation';
import { DeliveryActionPanel, DeliverySection } from '@/features/delivery/components/DeliveryCards';
import { PickupActions } from '@/features/delivery/components/PickupActions';
import {
  ReturnDeliveryFilters,
  ReturnDeliveryListCard,
  ReturnDeliveryProduct,
  ReturnDeliveryRoute,
  ReturnDeliverySummary,
  ReturnDeliveryTimeline,
} from '@/features/delivery/components/ReturnDeliveryCards';
import {
  getReturnDeliveries,
  getReturnDelivery,
  returnDeliveryAction,
} from '@/features/delivery/services/deliveryReturnsApi';
import {
  ReturnFeedback,
  ReturnLayout,
  ReturnPagination,
  useReturnRefresh,
} from '@/features/returns/components/ReturnLayout';
import { useApiQuery } from '@/shared/hooks/useApiQuery';
import { AppText } from '@/shared/ui';

/** Desmonta dados privados ao trocar de conta; o grupo protegido valida o tipo de utilizador. */
export function DeliveryReturnListScreen() {
  const { session } = useAuth();
  return session ? <DeliveryReturnList key={session.token} token={session.token} /> : null;
}
/** Lista paginada com as recolhas reversas atribuídas, sem criar nem redistribuir tarefas. */
function DeliveryReturnList({ token }) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const loader = useCallback(() => getReturnDeliveries(token, page, status), [token, page, status]);
  const query = useApiQuery(loader);
  useReturnRefresh(query.refresh);
  return (
    <ReturnLayout
      title="Devoluções"
      subtitle="Recolhas reversas atribuídas a si."
      backTo="/(delivery)/delivery"
      onRefresh={query.refresh}
      refreshLabel="Atualizar devoluções"
      busy={query.isLoading}
      scrollKey={`${page}-${status}`}
    >
      <ReturnDeliveryFilters
        value={status}
        onChange={(value) => {
          setStatus(value);
          setPage(1);
        }}
      />
      <ReturnFeedback
        {...query}
        loadingText="A consultar devoluções..."
        empty={Boolean(query.data && !query.data.data.length)}
        emptyText="Ainda não tem devoluções atribuídas."
        onRetry={query.refresh}
      />
      {(query.data?.data || []).map((delivery) => (
        <ReturnDeliveryListCard
          key={delivery.id}
          delivery={delivery}
          onPress={() =>
            router.push({
              pathname: '/(delivery)/delivery/returns/[id]',
              params: { id: delivery.id },
            })
          }
        />
      ))}
      {query.data ? <ReturnPagination page={page} data={query.data} onPage={setPage} /> : null}
    </ReturnLayout>
  );
}
/** Liga a referência da rota à sessão atual, sem conservar dados entre contas. */
export function DeliveryReturnDetailScreen() {
  const { session } = useAuth();
  const params = useLocalSearchParams();
  const id = routeValue(params.id);
  return session ? (
    <DeliveryReturnDetail key={`${session.token}-${id}`} token={session.token} id={id} />
  ) : null;
}
/** Mantém recolha, transporte e entrega na loja numa sequência simples e isolada. */
function DeliveryReturnDetail({ token, id }) {
  const loader = useCallback(() => getReturnDelivery(token, id), [token, id]);
  const query = useApiQuery(loader);
  useReturnRefresh(query.refresh);
  const [busy, setBusy] = useState(false);
  const delivery = query.data;
  const action =
    ['CONFIRM_PICKUP', 'START_TRANSIT', 'CONFIRM_STORE_DELIVERY'].find((candidate) =>
      delivery?.allowed_actions?.includes(candidate),
    ) ?? null;
  const config = action ? returnActionConfig[action] : null;
  return (
    <ReturnLayout
      title="Detalhe da devolução"
      backTo="/(delivery)/delivery/returns"
      onRefresh={query.refresh}
      refreshLabel="Atualizar recolha"
      busy={busy || query.isLoading}
    >
      <ReturnFeedback {...query} loadingText="A consultar recolha..." onRetry={query.refresh} />
      {delivery ? (
        <>
          <ReturnDeliverySummary delivery={delivery} />
          {action && config ? (
            <PickupActions
              title="Próxima ação"
              key={action}
              Panel={DeliveryActionPanel}
              hint={config.hint}
              needsCode={config.needsCode}
              actions={[
                {
                  action,
                  label: config.label,
                  confirmation: config.confirmation,
                },
              ]}
              execute={(selected, code) => returnDeliveryAction(token, delivery, selected, code)}
              onRefresh={query.refresh}
              onBusy={setBusy}
            />
          ) : (
            <DeliverySection title="Acompanhamento" icon="information-circle-outline">
              <AppText color="muted">{waitingMessage(delivery.status)}</AppText>
            </DeliverySection>
          )}
          <ReturnDeliveryRoute delivery={delivery} />
          <ReturnDeliveryProduct delivery={delivery} />
          <ReturnDeliveryTimeline delivery={delivery} />
        </>
      ) : null}
    </ReturnLayout>
  );
}
/** Texto de acompanhamento para estados sem ação disponível no painel. */
function waitingMessage(status) {
  if (status === 'DELIVERED') return 'A recolha foi concluída e não requer outras ações.';
  if (['PICKUP_FAILED', 'DELIVERY_FAILED', 'CANCELLED'].includes(status))
    return 'Esta recolha não permite novas ações; a transportadora trata do seguimento.';
  if (status === 'ACCEPTED')
    return 'A transportadora aceitou a recolha e aguarda a distribuição ao Entregador.';
  return 'Não há ações disponíveis neste estado.';
}
/** Instruções de cada transição autorizada pela API. */
const returnActionConfig = {
  CONFIRM_PICKUP: {
    hint: 'Chegou ao Cliente? Peça os seis algarismos da devolução e confirme a recolha física do produto.',
    needsCode: true,
    label: 'Confirmar recolha',
    confirmation: 'Já recolheu fisicamente o produto junto do Cliente?',
  },
  START_TRANSIT: {
    hint: 'Confirme apenas quando sair com o produto rumo à loja de destino.',
    needsCode: false,
    label: 'Iniciar transporte',
    confirmation: 'Vai iniciar agora o transporte até à loja?',
  },
  CONFIRM_STORE_DELIVERY: {
    hint: 'Chegou à loja? Apresente o código emitido pelo Lojista para concluir a devolução.',
    needsCode: true,
    label: 'Confirmar entrega na loja',
    confirmation: 'Já entregou o produto na loja de destino?',
  },
};
