import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { routeValue } from '@/features/catalog/utils/productPresentation';
import {
  ComplaintAccess,
  ComplaintFeedback,
  ComplaintLayout,
  useComplaintMutation,
} from '@/features/complaints/components/ComplaintLayout';
import {
  complaintTypes,
  createComplaint,
  eligibleComplaintOrders,
  findOngoingComplaint,
} from '@/features/complaints/services/complaintsApi';
import { getOrder } from '@/features/orders/services/ordersApi';
import { useReturnRefresh } from '@/features/returns/components/ReturnLayout';
import { ReturnDetailPanel } from '@/features/returns/components/ReturnDetailCards';
import { useApiQuery } from '@/shared/hooks/useApiQuery';
import { AppText, Button, Input, Select } from '@/shared/ui';

/** Recebe apenas a referência da compra e consulta os dados oficiais antes de abrir o formulário. */
export function NewComplaintScreen() {
  const params = useLocalSearchParams();
  const reference = routeValue(params.reference);
  return (
    <ComplaintAccess>
      {(session) => (
        <ComplaintPurchase
          key={`${session.token}-${reference}`}
          token={session.token}
          reference={reference}
        />
      )}
    </ComplaintAccess>
  );
}

/** Recupera as encomendas de cada loja e os respetivos artigos sem confiar em identificadores da navegação. */
function ComplaintPurchase({ token, reference }) {
  const loader = useCallback(() => getOrder(token, reference), [token, reference]);
  const query = useApiQuery(loader);
  useReturnRefresh(query.refresh);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const eligible = eligibleComplaintOrders(query.data);
  return (
    <ComplaintLayout
      title="Abrir reclamação"
      subtitle="Descreva o problema com a sua compra."
      busy={busy || query.isLoading}
      onRefresh={query.refresh}
    >
      <ComplaintFeedback {...query} onRetry={query.refresh} />
      {query.data && eligible.length ? (
        <ComplaintForm token={token} purchase={query.data} onBusy={setBusy} />
      ) : null}
      {query.data && !eligible.length ? (
        <ReturnDetailPanel title="Sem encomendas disponíveis" icon="information-circle-outline">
          <AppText color="muted">
            Esta compra não tem encomendas ativas disponíveis para uma nova reclamação.
          </AppText>
          <Button
            label="As minhas reclamações"
            variant="outline"
            fullWidth
            onPress={() => router.replace('/(customer)/complaints')}
          />
        </ReturnDetailPanel>
      ) : null}
    </ComplaintLayout>
  );
}

/** Vincula a reclamação a uma loja e opcionalmente a um artigo, com os limites reais da API. */
function ComplaintForm({ token, purchase, onBusy }) {
  const router = useRouter();
  // O formulário recebe a compra completa, mas só apresenta as lojas autorizadas pela API.
  const orders = eligibleComplaintOrders(purchase);
  const [orderId, setOrderId] = useState(orders.length === 1 ? String(orders[0].id) : '');
  const [itemId, setItemId] = useState('');
  const [type, setType] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const mutation = useComplaintMutation();
  const order = orders.find((entry) => String(entry.id) === orderId);
  const disabled = mutation.busy || mutation.unknown;
  // Só a combinação já em curso é bloqueada; as outras categorias e artigos mantêm-se disponíveis.
  const duplicate = findOngoingComplaint(order, itemId, type);

  /** Mudar de loja limpa o artigo para nunca enviar um item de outra encomenda. */
  function changeOrder(value) {
    setOrderId(value);
    setItemId('');
  }

  /** Conserva os campos em falhas; uma resposta incerta encaminha à lista antes de qualquer reenvio. */
  function submit() {
    return mutation.run(
      () => createComplaint(token, purchase, { orderId, itemId, type, subject, description }),
      (complaint) => {
        // Sem identificador confirmado, a lista permite verificar a criação sem duplicar o pedido.
        router.replace(
          complaint?.id
            ? { pathname: '/(customer)/complaints/[id]', params: { id: complaint.id } }
            : '/(customer)/complaints',
        );
      },
      onBusy,
    );
  }

  return (
    <ReturnDetailPanel title="Dados da reclamação" icon="chatbox-ellipses-outline">
      <Select
        label="Encomenda da loja"
        value={orderId}
        onChange={changeOrder}
        disabled={disabled}
        placeholder="Escolha a loja desta compra"
        options={orders.map((entry) => ({
          value: String(entry.id),
          label: `${entry.store?.name || 'Loja'} · ${entry.reference}`,
        }))}
      />
      <Select
        label="Artigo (opcional)"
        value={itemId}
        onChange={setItemId}
        disabled={disabled || !orderId}
        placeholder="Toda a encomenda"
        options={[
          { value: '', label: 'Toda a encomenda' },
          ...(order?.items || []).map((item) => ({
            value: String(item.id),
            label: item.product?.name || 'Produto',
          })),
        ]}
      />
      <Select
        label="Categoria"
        value={type}
        onChange={setType}
        disabled={disabled}
        placeholder="Escolha a categoria"
        options={complaintTypes}
      />
      {duplicate ? (
        <>
          <AppText color="muted" accessibilityRole="alert">
            Já existe uma reclamação em curso para esta encomenda, artigo e categoria. Pode
            consultá-la ou selecionar outro problema.
          </AppText>
          <Button
            label="Ver reclamação existente"
            variant="outline"
            fullWidth
            disabled={mutation.busy}
            onPress={() =>
              router.push({ pathname: '/(customer)/complaints/[id]', params: { id: duplicate.id } })
            }
          />
        </>
      ) : null}
      <Input
        label="Assunto"
        value={subject}
        onChangeText={setSubject}
        maxLength={180}
        editable={!disabled}
        helperText="Resuma o problema em até 180 caracteres."
      />
      <Input
        label="Descrição"
        value={description}
        onChangeText={setDescription}
        maxLength={5000}
        multiline
        editable={!disabled}
        helperText="Explique a situação com 10 a 5000 caracteres."
      />
      {mutation.error ? (
        <AppText accessibilityRole="alert" color="danger">
          {mutation.error}
        </AppText>
      ) : null}
      {mutation.unknown ? (
        <Button
          label="Consultar as minhas reclamações"
          fullWidth
          onPress={() => router.replace('/(customer)/complaints')}
        />
      ) : (
        <Button
          label="Enviar reclamação"
          fullWidth
          loading={mutation.busy}
          disabled={
            !orderId ||
            !type ||
            Boolean(duplicate) ||
            !subject.trim() ||
            description.trim().length < 10
          }
          onPress={submit}
        />
      )}
    </ReturnDetailPanel>
  );
}
