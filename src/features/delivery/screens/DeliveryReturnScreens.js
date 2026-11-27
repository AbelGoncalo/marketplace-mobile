import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';
import { DeliveryActionRow } from '@/features/delivery/components/DeliveryCards';
import { ReturnDeliveryFailure } from '@/features/delivery/components/ReturnDeliveryFailure';
import { returnFailureReasons } from '@/features/delivery/services/returnFailureApi';
import { useCallback, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/features/auth/context/AuthContext';
import { routeValue } from '@/features/catalog/utils/productPresentation';
import { PickupActions } from '@/features/delivery/components/PickupActions';
import {
  ReturnDeliveryFilters,
  ReturnDeliveryActionPanel,
  ReturnDeliveryPanel,
  ReturnDeliveryListCard,
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
import { colors, spacing } from '@/theme';

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
        emptyText={
          status
            ? 'Não existem recolhas neste estado. Consulte Todas as recolhas.'
            : 'Não tem recolhas atribuídas neste momento. Numa nova tentativa, a tarefa aparece depois de a transportadora atribuir novamente o entregador e o veículo.'
        }
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
  const router = useRouter();
  const loader = useCallback(() => getReturnDelivery(token, id), [token, id]);
  const query = useApiQuery(loader);
  const [busy, setBusy] = useState(false);
  const [failureOpen, setFailureOpen] = useState(false);
  const [reported, setReported] = useState(null);
  const refreshQuery = query.refresh;
  // Toda a nova consulta fecha o formulário anterior, incluindo o regresso ao detalhe.
  const refresh = useCallback(() => {
    setFailureOpen(false);
    refreshQuery();
  }, [refreshQuery]);
  useReturnRefresh(refresh);
  const delivery = query.data;
  // Um 404 tratado pelo serviço representa ausência de acesso, sem presumir cancelamento ou reagendamento.
  const unavailable = !query.isLoading && !query.error && delivery === null;
  const action =
    ['CONFIRM_PICKUP', 'START_TRANSIT', 'CONFIRM_STORE_DELIVERY'].find((candidate) =>
      delivery?.allowed_actions?.includes(candidate),
    ) ?? null;
  const config = action ? returnActionConfig[action] : null;
  return (
    <ReturnLayout
      title="Detalhe da devolução"
      backTo="/(delivery)/delivery/returns"
      onRefresh={refresh}
      refreshLabel="Atualizar recolha"
      busy={busy || query.isLoading}
    >
      {reported && !unavailable ? (
        <ReturnDeliveryPanel title="Ocorrência registada" icon="checkmark-circle-outline">
          <AppText>O Centro recebeu a falha para análise.</AppText>
          <AppText variant="caption" color="muted">
            {reported.return_delivery_status === 'PICKUP_FAILED'
              ? 'Recolha não concluída.'
              : 'Entrega na loja não concluída.'}{' '}
            O pedido de devolução continua em análise.
          </AppText>
        </ReturnDeliveryPanel>
      ) : null}
      <ReturnFeedback {...query} loadingText="A consultar recolha..." onRetry={refresh} />
      {unavailable ? (
        <ReturnDeliveryPanel title="Recolha indisponível" icon="swap-horizontal-outline">
          <AppText variant="bodyStrong">
            Esta recolha já não está disponível para a sua conta.
          </AppText>
          <AppText color="muted">
            A atribuição pode ter sido atualizada. Quando o Centro autoriza outra tentativa, a
            transportadora precisa atribuir novamente o entregador e o veículo.
          </AppText>
          <AppText variant="caption" color="muted">
            Consulte as tarefas atribuídas a si. Se a recolha lhe for atribuída novamente, voltará a
            aparecer na lista.
          </AppText>
          {/* Reutiliza a ação em linha já usada nas operações do entregador. */}
          <DeliveryActionRow
            label="Ver as minhas recolhas"
            icon="list-outline"
            onPress={() => router.replace('/(delivery)/delivery/returns')}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Verificar atribuição"
            onPress={refresh}
            style={({ pressed }) => [styles.secondaryAction, pressed && styles.secondaryPressed]}
          >
            <Ionicons name="refresh-outline" size={18} color={colors.primary} />
            <AppText variant="caption" color="primary" style={styles.secondaryLabel}>
              Verificar atribuição
            </AppText>
          </Pressable>
        </ReturnDeliveryPanel>
      ) : null}
      {delivery ? (
        <>
          <ReturnDeliverySummary delivery={delivery} />
          <View
            style={{ gap: 16 }}
            pointerEvents={busy ? 'none' : 'auto'}
            accessibilityElementsHidden={busy}
            importantForAccessibility={busy ? 'no-hide-descendants' : 'auto'}
          >
            {!failureOpen ? (
              action && config ? (
                <PickupActions
                  title="Próxima ação"
                  key={action}
                  Panel={ReturnDeliveryActionPanel}
                  hint={config.hint}
                  needsCode={config.needsCode}
                  actions={[
                    {
                      action,
                      label: config.label,
                      confirmation: config.confirmation,
                    },
                  ]}
                  execute={(selected, code) =>
                    returnDeliveryAction(token, delivery, selected, code)
                  }
                  onRefresh={refresh}
                  onBusy={setBusy}
                />
              ) : (
                <ReturnDeliveryPanel title="Acompanhamento" icon="information-circle-outline">
                  <AppText color="muted">{waitingMessage(delivery.status)}</AppText>
                </ReturnDeliveryPanel>
              )
            ) : null}
            {returnFailureReasons(delivery).length ? (
              <ReturnDeliveryFailure
                key={delivery.status}
                token={token}
                delivery={delivery}
                onOpen={setFailureOpen}
                onBusy={setBusy}
                onRefresh={() => {
                  setFailureOpen(false);
                  refresh();
                }}
                onReported={(result) => {
                  setReported(result);
                  setFailureOpen(false);
                  refresh();
                }}
              />
            ) : null}
          </View>
          <ReturnDeliveryRoute delivery={delivery} />
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
    return 'Esta recolha não permite novas ações. O Centro analisa a ocorrência e define o seguimento.';
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

// A verificação fica visualmente secundária, com área de toque confortável e texto adaptável.
const styles = StyleSheet.create({
  secondaryAction: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  secondaryLabel: { flexShrink: 1 },
  secondaryPressed: { opacity: 0.65 },
});
