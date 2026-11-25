import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/features/auth/context/AuthContext';
import { cartApi } from '@/features/cart/services/cartApi';
import { useCart } from '@/features/cart/context/CartContext';
import {
  CheckoutAmount,
  CheckoutFeedback,
  CheckoutLayout,
  CheckoutNotice,
  CheckoutSection,
} from '@/features/checkout/components/CheckoutLayout';
import { ProductImage } from '@/features/catalog/components/ProductImage';
import { formatPrice } from '@/features/catalog/utils/productPresentation';
import { AddressForm } from '@/features/checkout/components/AddressForm';
import {
  getAddresses,
  getDeliveryOptions,
  previewCheckout,
  confirmCheckout,
} from '@/features/checkout/services/checkoutApi';
import {
  getCheckoutAttempt,
  saveCheckoutAttempt,
  removeCheckoutAttempt,
} from '@/features/checkout/services/checkoutStorage';
import {
  checkoutKey,
  createCheckoutFlow,
  deliverySelections,
  previewExpired,
  previewDeadline,
  renewCheckoutAttempt,
} from '@/features/checkout/services/checkoutFlow';
import { useApiQuery } from '@/shared/hooks/useApiQuery';
import { AppText, Button, Select } from '@/shared/ui';
import { colors, spacing } from '@/theme';

/** Exige uma conta de Cliente e oferece login com retorno apenas para esta rota conhecida. */
export function CheckoutScreen() {
  const { session } = useAuth();
  const router = useRouter();
  if (!session)
    return (
      <CheckoutLayout>
        <CheckoutSection
          title="Entre para continuar"
          description="Use a sua conta de Cliente para escolher a entrega e confirmar a compra."
        >
          <Button
            fullWidth
            label="Entrar"
            onPress={() =>
              router.push({ pathname: '/(auth)/login', params: { returnTo: 'checkout' } })
            }
          />
        </CheckoutSection>
      </CheckoutLayout>
    );
  if (session.user.accountType !== 'Cliente')
    return (
      <CheckoutLayout>
        <CheckoutNotice>Entre com uma conta de Cliente para continuar a compra.</CheckoutNotice>
      </CheckoutLayout>
    );
  return <CheckoutLoader key={session.token} session={session} />;
}

/** Recupera primeiro a tentativa persistida, mesmo se o carrinho já foi convertido em compra. */
function CheckoutLoader({ session }) {
  const loader = useCallback(
    async () => ({ attempt: await getCheckoutAttempt(session.user.id) }),
    [session.user.id],
  );
  const query = useApiQuery(loader);
  return query.data ? (
    <CheckoutContent session={session} initial={query.data.attempt} />
  ) : (
    <CheckoutLayout>
      <CheckoutFeedback {...query} onRetry={query.refresh} />
    </CheckoutLayout>
  );
}

/** Mantém cotação e confirmação recuperáveis; falhas de rede nunca geram uma nova chave. */
function CheckoutContent({ session, initial }) {
  const router = useRouter();
  const cart = useCart();
  const [attempt, setAttempt] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rejected, setRejected] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // Actualiza a validade para disponibilizar a renovação assim que a cotação termina.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  const expired = Boolean(attempt?.preview) && previewExpired(attempt.preview, now);
  const lock = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  /** Só atualiza a tela depois da persistência, antes de qualquer operação comercial. */
  async function save(next) {
    await saveCheckoutAttempt(session.user.id, next);
    if (active.current) setAttempt(next);
  }
  /** Cria o coordenador apenas numa ação, mantendo refs fora da renderização. */
  function flow() {
    return createCheckoutFlow({
      save,
      preview: (payload) => previewCheckout(session.token, payload),
      confirm: (payload) => confirmCheckout(session.token, payload),
    });
  }

  /** Bloqueia duplos toques e mantém falhas definitivas distintas de respostas desconhecidas. */
  async function run(operation) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setRejected(false);
    try {
      await operation();
    } catch (requestError) {
      if (active.current) {
        setError(requestError.message);
        setRejected(requestError.status === 422);
      }
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
    }
  }

  /** Abandona apenas uma cotação não confirmada ou uma rejeição definitiva do servidor. */
  async function reset() {
    await removeCheckoutAttempt(session.user.id);
    if (active.current) setAttempt(null);
  }

  if (attempt?.receipt)
    return (
      <CheckoutLayout
        busy={busy}
        title="Compra confirmada"
        subtitle="Acompanhe a sua encomenda a partir daqui."
      >
        <CheckoutSection
          icon="checkmark-circle-outline"
          emphasized
          title="Compra confirmada"
          description="A sua encomenda foi registada."
        >
          <CheckoutNotice>
            Pagamento pendente. Consulte os detalhes da encomenda para acompanhar o estado.
          </CheckoutNotice>
          <AppText selectable color="muted" variant="caption">
            Referência: {attempt.receipt.reference}
          </AppText>
          <CheckoutAmount
            label="Total da compra"
            value={formatPrice(attempt.receipt.total)}
            strong
          />
        </CheckoutSection>
        {(attempt.receipt.orders || []).map((order) => (
          <CheckoutSection
            key={order.reference}
            title={order.store?.name}
            icon="storefront-outline"
          >
            <AppText selectable color="muted" variant="caption">
              {order.reference}
            </AppText>
            <CheckoutAmount label="Total da loja" value={formatPrice(order.total)} />
          </CheckoutSection>
        ))}

        {attempt.receipt.payment_attempt?.expires_at ? (
          <AppText>
            Prazo da reserva:{' '}
            {new Date(attempt.receipt.payment_attempt.expires_at).toLocaleString('pt-PT')}
          </AppText>
        ) : null}
        <CheckoutNotice>
          O pagamento ainda não está disponível na aplicação. Esta confirmação não efetua qualquer
          cobrança.
        </CheckoutNotice>
        {error ? <AppText color="danger">{error}</AppText> : null}
        <Button
          fullWidth
          label="Ver encomenda"
          disabled={busy}
          onPress={() =>
            router.push({
              pathname: '/(customer)/orders/[reference]',
              params: { reference: attempt.receipt.reference },
            })
          }
        />
        <Button
          fullWidth
          label="As minhas encomendas"
          variant="outline"
          disabled={busy}
          onPress={() => router.push('/(customer)/orders')}
        />
        <Button
          fullWidth
          label="Voltar ao carrinho"
          variant="outline"
          loading={busy}
          onPress={() =>
            run(async () => {
              await reset();
              await cart.refresh();
              router.replace('/(customer)/(tabs)/cart');
            })
          }
        />
      </CheckoutLayout>
    );

  return (
    <CheckoutLayout
      busy={busy}
      subtitle={
        attempt
          ? 'Reveja os detalhes antes de confirmar.'
          : 'Comece pela morada e escolha a entrega.'
      }
    >
      {error ? <CheckoutNotice danger>{error}</CheckoutNotice> : null}
      {attempt ? (
        <>
          {attempt.preview ? (
            <CheckoutSummary
              preview={attempt.preview}
              expired={expired}
              confirmationPending={attempt.confirmStarted}
            />
          ) : (
            <CheckoutNotice>
              Não foi possível obter o resumo anterior. Tente novamente para continuar.
            </CheckoutNotice>
          )}
          {attempt.confirmStarted ? (
            <CheckoutNotice>
              A confirmação ficou por verificar. Toque em Retomar confirmação para consultar o
              resultado da mesma compra.
            </CheckoutNotice>
          ) : null}
          {attempt.preview ? (
            <Button
              fullWidth
              label={
                attempt.confirmStarted
                  ? 'Retomar confirmação'
                  : expired
                    ? 'Gerar novo resumo'
                    : 'Confirmar compra'
              }
              loading={busy}
              onPress={() =>
                run(async () => {
                  if (expired && !attempt.confirmStarted) {
                    await flow().review(renewCheckoutAttempt(attempt));
                  } else {
                    await flow().confirm(attempt);
                    cart.refresh().catch(() => {});
                  }
                })
              }
            />
          ) : (
            <Button
              fullWidth
              label="Recuperar resumo"
              loading={busy}
              onPress={() => run(() => flow().review(attempt))}
            />
          )}
          {!attempt.confirmStarted || rejected ? (
            <Button
              fullWidth
              label="Alterar entrega"
              variant="outline"
              disabled={busy}
              onPress={() => run(reset)}
            />
          ) : null}
        </>
      ) : (
        <CheckoutChoices
          token={session.token}
          busy={busy}
          onReview={(addressId, deliveries) =>
            run(() =>
              flow().review({
                previewPayload: {
                  address_id: addressId,
                  deliveries,
                  idempotency_key: checkoutKey(),
                },
                confirmKey: checkoutKey(),
                confirmStarted: false,
              }),
            )
          }
        />
      )}
    </CheckoutLayout>
  );
}

/** Carrega moradas e garante a fusão do visitante antes de consultar opções de entrega. */
function CheckoutChoices({ token, busy, onReview }) {
  const loader = useCallback(async () => {
    await cartApi.load(token);
    return getAddresses(token);
  }, [token]);
  const query = useApiQuery(loader);
  const [address, setAddress] = useState('');
  const [created, setCreated] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const addresses = [
    ...(created ? [created] : []),
    ...(query.data || []).filter((item) => item.id !== created?.id),
  ];
  if (query.isLoading || query.error)
    return <CheckoutFeedback {...query} onRetry={query.refresh} />;
  return (
    <View style={styles.group}>
      <CheckoutFeedback {...query} onRetry={query.refresh} />
      <CheckoutSection
        step="1"
        title="Morada"
        description="Escolha onde pretende receber a encomenda."
      >
        {!query.isLoading && !query.error && !addresses.length ? (
          <AppText color="muted">
            Ainda não tem uma morada guardada. Adicione uma para continuar.
          </AppText>
        ) : null}
        <Select
          label="Morada de entrega"
          value={address}
          placeholder="Escolha uma morada"
          disabled={busy}
          options={addresses.map((item) => ({
            value: String(item.id),
            label: `${item.address} · ${item.municipality?.name || ''}`,
          }))}
          onChange={setAddress}
        />
        <Button
          fullWidth
          label={showForm ? 'Fechar nova morada' : 'Adicionar morada'}
          variant="outline"
          disabled={busy}
          onPress={() => setShowForm((value) => !value)}
        />
        {showForm ? (
          <AddressForm
            token={token}
            onSaved={(item) => {
              setCreated(item);
              setAddress(String(item.id));
              setShowForm(false);
            }}
          />
        ) : null}
      </CheckoutSection>
      {address && !showForm ? (
        <DeliveryChoices
          key={address}
          token={token}
          addressId={Number(address)}
          busy={busy}
          onReview={onReview}
        />
      ) : null}
    </View>
  );
}

/** Exige uma escolha explícita para cada loja, incluindo levantamento sem portes. */
function DeliveryChoices({ token, addressId, busy, onReview }) {
  const loader = useCallback(() => getDeliveryOptions(token, addressId), [token, addressId]);
  const query = useApiQuery(loader);
  const [choices, setChoices] = useState({});
  const [error, setError] = useState('');
  const stores = query.data?.stores || [];

  /** Valida a cobertura de todas as lojas antes de pedir os totais definitivos. */
  function review() {
    try {
      setError('');
      onReview(addressId, deliverySelections(stores, choices));
    } catch (validationError) {
      setError(validationError.message);
    }
  }
  return (
    <CheckoutSection step="2" title="Entrega" description="Escolha uma modalidade para cada loja.">
      <CheckoutFeedback
        {...query}
        onRetry={query.refresh}
        empty={Boolean(query.data) && !stores.length}
        emptyMessage="O carrinho está vazio."
      />
      {stores.map(({ store, options }) => (
        <Select
          key={store.id}
          label={`Entrega · ${store.name}`}
          value={choices[store.id] ?? ''}
          placeholder="Escolha a modalidade"
          disabled={busy}
          options={options.map((option, index) => ({
            value: String(index),
            label:
              option.delivery_method === 'PICKUP'
                ? 'Levantamento na loja · sem portes'
                : `${option.carrier?.name || 'Transportadora'} · ${option.modality?.name || option.service_type} · ${formatPrice(option.price)}`,
          }))}
          onChange={(value) => setChoices((current) => ({ ...current, [store.id]: value }))}
        />
      ))}
      {error ? <AppText color="danger">{error}</AppText> : null}
      {stores.length ? (
        <Button fullWidth label="Rever compra" loading={busy} onPress={review} />
      ) : null}
    </CheckoutSection>
  );
}

/** Separa a revisão em morada, produtos e totais, com mensagens curtas de validade. */
function CheckoutSummary({ preview, expired, confirmationPending }) {
  return (
    <View style={styles.group}>
      <CheckoutSection title="Morada de entrega" icon="location-outline">
        <AppText>{preview.delivery_address?.address}</AppText>
        <AppText color="muted" variant="caption">
          {preview.delivery_address?.phone}
        </AppText>
      </CheckoutSection>
      <CheckoutNotice danger={expired && !confirmationPending}>
        {confirmationPending
          ? 'A confirmação anterior pode ser retomada em segurança.'
          : expired
            ? 'O resumo expirou. Gere um novo para atualizar preços e disponibilidade.'
            : Number.isFinite(previewDeadline(preview))
              ? `Preços válidos até ${new Date(previewDeadline(preview)).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}. A disponibilidade será verificada ao confirmar.`
              : 'Os preços e a disponibilidade serão verificados ao confirmar.'}
      </CheckoutNotice>
      {(preview.stores || []).map((group) => (
        <CheckoutSection
          key={group.store.id}
          title={group.store.name}
          icon="storefront-outline"
          description={`${group.items.length} ${group.items.length === 1 ? 'produto' : 'produtos'}`}
        >
          {group.items.map((item) => (
            <View key={item.store_product_variant_id} style={styles.productRow}>
              <ProductImage
                path={item.product?.image}
                label={item.product?.name}
                style={styles.productImage}
              />
              <View style={styles.productInfo}>
                <AppText variant="bodyStrong" numberOfLines={2}>
                  {item.product?.name}
                </AppText>
                {item.product?.values?.length ? (
                  <AppText color="muted" variant="caption" numberOfLines={2}>
                    {item.product.values
                      .map((value) => `${value.feature || 'Opção'}: ${value.value}`)
                      .join(' · ')}
                  </AppText>
                ) : null}
                <View style={styles.productDetails}>
                  <AppText color="muted" variant="caption">
                    {item.quantity} un.
                  </AppText>
                  <AppText variant="bodyStrong" style={styles.productPrice}>
                    {formatPrice(item.subtotal)}
                  </AppText>
                </View>
              </View>
            </View>
          ))}
          <CheckoutAmount
            label={
              group.delivery?.delivery_method === 'PICKUP' ? 'Levantamento na loja' : 'Entrega'
            }
            value={formatPrice(group.delivery?.fee)}
          />
          {group.delivery?.carrier ? (
            <AppText color="muted" variant="caption">
              {group.delivery.carrier}
            </AppText>
          ) : null}
        </CheckoutSection>
      ))}
      {(preview.price_changes || []).map((item) => (
        <CheckoutNotice key={item.store_product_variant_id}>
          O preço de {item.product_name} foi atualizado de {formatPrice(item.observed_unit_price)}{' '}
          para {formatPrice(item.current_unit_price)}.
        </CheckoutNotice>
      ))}
      <CheckoutSection
        title="Resumo da compra"
        description="Valores confirmados para esta compra"
        icon="receipt-outline"
        emphasized
      >
        <CheckoutAmount label="Produtos" value={formatPrice(preview.subtotal)} />
        {Number(preview.discount_total) > 0 ? (
          <CheckoutAmount label="Descontos" value={formatPrice(preview.discount_total)} />
        ) : null}
        <CheckoutAmount label="Entrega" value={formatPrice(preview.delivery_total)} />
        <View style={styles.divider} />
        <CheckoutAmount label="Total" value={formatPrice(preview.total)} strong />
        <AppText color="muted" variant="caption">
          A encomenda ficará pendente de pagamento. Não será efetuada qualquer cobrança ao
          confirmar.
        </AppText>
      </CheckoutSection>
    </View>
  );
}

// Os grupos internos não repetem margens de página; os valores alinham com os respetivos produtos.
const styles = StyleSheet.create({
  group: { gap: spacing.md },
  productRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  productImage: { width: 56, height: 64, borderRadius: 8, overflow: 'hidden' },
  productInfo: { flex: 1, minWidth: 0, gap: spacing.sm },
  productDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  productPrice: {
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 'auto',
    fontVariant: ['tabular-nums'],
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
});
