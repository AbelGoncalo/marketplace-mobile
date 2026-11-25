import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  ReturnAccess,
  ReturnFeedback,
  ReturnLayout,
  ReturnPagination,
  ReturnPanel,
} from '@/features/returns/components/ReturnLayout';
import { ReturnAttachmentPicker } from '@/features/returns/components/ReturnAttachments';
import { ReturnProduct } from '@/features/returns/components/ReturnProduct';
import {
  createReturn,
  getEligibleReturnItems,
  returnError,
  returnOutcomeUnknown,
  returnReasons,
} from '@/features/returns/services/returnsApi';
import { orderDate } from '@/features/orders/utils/orderPresentation';
import { useApiQuery } from '@/shared/hooks/useApiQuery';
import { AppText, Button, Input, Select } from '@/shared/ui';

/** Mantém a seleção e os campos restritos à sessão autenticada atual. */
export function NewReturnScreen() {
  return (
    <ReturnAccess>
      {(session) => <NewReturn key={session.token} token={session.token} />}
    </ReturnAccess>
  );
}

/** O seletor utiliza exclusivamente a lista paginada de elegibilidade fornecida pela API. */
function NewReturn({ token }) {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const loader = useCallback(() => getEligibleReturnItems(token, page), [token, page]);
  const query = useApiQuery(loader);
  const items = (query.data?.data || []).filter(
    (item) => item.can_request_return && Number(item.returnable_quantity) > 0,
  );

  /** Reconsulta a quantidade disponível ao regressar à escolha do produto. */
  function changeProduct() {
    setSelected(null);
    query.refresh();
  }

  return (
    <ReturnLayout
      scrollKey={selected ? `form-${selected.order_item_id}` : `items-${page}`}
      title="Solicitar devolução"
      subtitle="Escolha um produto e explique o motivo."
      onRefresh={!selected ? query.refresh : undefined}
      busy={submitting || (query.isLoading && !selected)}
    >
      {selected ? (
        <ReturnRequestForm
          token={token}
          item={selected}
          onChangeProduct={changeProduct}
          onBusy={setSubmitting}
        />
      ) : (
        <>
          <ReturnPanel>
            <AppText variant="bodyStrong">Que produto pretende devolver?</AppText>
            <AppText color="muted">
              Os produtos disponíveis dependem da política da compra, do prazo e da quantidade ainda
              devolvível.
            </AppText>
          </ReturnPanel>
          <ReturnFeedback
            {...query}
            empty={Boolean(query.data && !items.length)}
            emptyText="Não há produtos elegíveis nesta página. Consulte outras páginas, se disponíveis."
            onRetry={query.refresh}
          />
          {items.map((item) => (
            <ReturnPanel key={item.order_item_id}>
              <ReturnProduct product={item.product} store={item.store?.name}>
                <AppText color="muted" variant="caption">
                  Disponível: {item.returnable_quantity} de {item.purchased_quantity} unidade(s)
                </AppText>
              </ReturnProduct>
              <AppText variant="caption" color="muted">
                Prazo da política: {orderDate(item.return_policy?.deadline_at)}
              </AppText>
              <Button
                label="Selecionar produto"
                variant="outline"
                onPress={() => setSelected(item)}
                fullWidth
              />
            </ReturnPanel>
          ))}
          {query.data ? <ReturnPagination page={page} data={query.data} onPage={setPage} /> : null}
        </>
      )}
    </ReturnLayout>
  );
}

/** Bloqueia envios repetidos e conserva os campos perante uma rejeição recuperável. */
function ReturnRequestForm({ token, item, onChangeProduct, onBusy }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [picking, setPicking] = useState(false);
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

  /** Não volta a criar um pedido com resposta perdida: primeiro encaminha para os pedidos existentes. */
  async function submit() {
    if (locked.current || unknown || picking) return;
    locked.current = true;
    setBusy(true);
    onBusy(true);
    setError('');
    try {
      const request = await createReturn(token, item, {
        quantity,
        reason,
        description,
        attachments,
      });
      if (active.current)
        router.replace({ pathname: '/(customer)/returns/[id]', params: { id: request.id } });
    } catch (failure) {
      if (active.current) {
        const uncertain = returnOutcomeUnknown(failure);
        setUnknown(uncertain);
        setError(
          uncertain
            ? 'Não foi possível confirmar se o pedido foi guardado. Consulte as suas devoluções antes de criar outro pedido.'
            : returnError(failure),
        );
      }
    } finally {
      locked.current = false;
      if (active.current) {
        setBusy(false);
        onBusy(false);
      }
    }
  }

  return (
    <>
      <ReturnPanel title="Produto selecionado">
        <ReturnProduct product={item.product} store={item.store?.name} />
        <AppText color="muted" variant="caption">
          Quantidade disponível: {item.returnable_quantity} · Prazo:{' '}
          {orderDate(item.return_policy?.deadline_at)}
        </AppText>
        <Button
          label="Alterar produto"
          variant="outline"
          onPress={onChangeProduct}
          disabled={busy || unknown || picking}
        />
      </ReturnPanel>
      <ReturnAttachmentPicker
        files={attachments}
        onChange={setAttachments}
        onPicking={setPicking}
        disabled={busy || unknown}
      />
      <ReturnPanel title="Motivo da devolução">
        <Input
          label="Quantidade"
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="number-pad"
          editable={!busy && !unknown}
          helperText={`De 1 a ${item.returnable_quantity} unidade(s)`}
        />
        <Select
          label="Motivo"
          placeholder="Selecione o motivo"
          options={returnReasons}
          value={reason}
          onChange={setReason}
          disabled={busy || unknown || picking}
        />
        <Input
          label="Descrição"
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={5000}
          editable={!busy && !unknown}
          placeholder="Explique o que aconteceu com o produto."
          style={{ minHeight: 120, textAlignVertical: 'top' }}
          helperText="Entre 10 e 5000 caracteres."
        />
        <AppText color="muted" variant="caption">
          O envio inicia a análise do pedido. Aguarde as instruções antes de devolver o produto.
        </AppText>
        {error ? (
          <AppText accessibilityRole="alert" color="danger">
            {error}
          </AppText>
        ) : null}
        {unknown ? (
          <Button
            label="Consultar as minhas devoluções"
            variant="outline"
            onPress={() => router.replace('/(customer)/returns')}
            fullWidth
          />
        ) : (
          <Button
            label="Enviar pedido"
            onPress={submit}
            loading={busy}
            disabled={!reason || picking}
            fullWidth
          />
        )}
      </ReturnPanel>
    </>
  );
}
