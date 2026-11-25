import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ProductImage } from '@/features/catalog/components/ProductImage';
import { formatPrice } from '@/features/catalog/utils/productPresentation';
import { useCart } from '@/features/cart/context/CartContext';
import { validQuantity } from '@/features/cart/services/cartApi';
import { AppText, Button, Screen } from '@/shared/ui';
import { colors, radii, spacing } from '@/theme';

/** Organiza produtos por loja e mantém o total e a ação principal sempre acessíveis. */
export function CartScreen() {
  const router = useRouter();
  const cart = useCart();
  const { refresh, canShop } = cart;
  const hasItems = canShop && cart.totalQuantity > 0;

  useFocusEffect(
    useCallback(() => {
      if (canShop) refresh().catch(() => {});
    }, [refresh, canShop]),
  );

  /** Confirma a remoção global sem atribuir destaque visual excessivo à ação destrutiva. */
  function confirmClear() {
    Alert.alert('Esvaziar carrinho', 'Remover todos os produtos do carrinho?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover todos', style: 'destructive', onPress: () => cart.clear().catch(() => {}) },
    ]);
  }

  return (
    <Screen padded={false} contentStyle={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant="heading1">Carrinho</AppText>
          <AppText color="muted" variant="caption">
            {hasItems
              ? `${cart.totalItems} ${cart.totalItems === 1 ? 'artigo' : 'artigos'} · ${cart.totalQuantity} ${cart.totalQuantity === 1 ? 'unidade' : 'unidades'}`
              : 'Os seus produtos, num só lugar'}
          </AppText>
        </View>
        {canShop ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Atualizar carrinho"
            disabled={cart.pending}
            onPress={() => refresh().catch(() => {})}
            style={styles.iconAction}
          >
            {cart.pending ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Ionicons name="refresh-outline" size={21} color={colors.primary} />
            )}
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          canShop ? (
            <RefreshControl
              refreshing={cart.pending && cart.ready}
              onRefresh={() => refresh().catch(() => {})}
              tintColor={colors.primary}
            />
          ) : undefined
        }
      >
        {cart.error ? (
          <View style={styles.notice}>
            <Ionicons name="alert-circle-outline" color={colors.danger} size={20} />
            <View style={styles.noticeText}>
              <AppText color="danger" variant="caption">
                {cart.error}
              </AppText>
              <Pressable
                accessibilityRole="button"
                disabled={cart.pending}
                onPress={() => refresh().catch(() => {})}
                style={styles.retry}
              >
                <AppText color="primary" variant="caption">
                  Tentar novamente
                </AppText>
              </Pressable>
            </View>
          </View>
        ) : null}
        {!canShop ? (
          <CartEmpty
            title="Uma conta para comprar"
            description="Utilize uma conta de Cliente para gerir o seu carrinho."
          />
        ) : cart.ready && !hasItems ? (
          <CartEmpty
            title="O seu carrinho está vazio"
            description="Explore o catálogo e encontre os seus próximos favoritos."
            onBrowse={() => router.push('/(customer)/catalog')}
          />
        ) : !cart.ready ? (
          <View style={styles.initialLoading}>
            <ActivityIndicator color={colors.primary} />
            <AppText color="muted">A carregar os seus produtos...</AppText>
          </View>
        ) : null}
        {hasItems
          ? (cart.data?.stores || []).map((store) => (
              <View key={store.id} style={styles.store}>
                <View style={styles.storeHeader}>
                  <View style={styles.storeIcon}>
                    <Ionicons name="storefront-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.headerText}>
                    <AppText variant="bodyStrong" numberOfLines={1}>
                      {store.name}
                    </AppText>
                    {store.shopping_center?.name ? (
                      <AppText color="muted" variant="caption" numberOfLines={1}>
                        {store.shopping_center.name}
                      </AppText>
                    ) : null}
                  </View>
                </View>
                {store.items.map((item) => (
                  <CartItem
                    key={`${item.id}-${item.quantity}-${item.observed_unit_price}`}
                    item={item}
                  />
                ))}
                <View style={styles.storeFooter}>
                  <AppText color="muted" variant="caption">
                    Subtotal da loja
                  </AppText>
                  <AppText variant="bodyStrong">{formatPrice(store.subtotal)}</AppText>
                </View>
              </View>
            ))
          : null}
        {hasItems ? (
          <View style={styles.secondaryActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(customer)/catalog')}
              style={styles.textAction}
            >
              <Ionicons name="add" size={18} color={colors.primary} />
              <AppText color="primary" variant="caption">
                Adicionar produtos
              </AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={cart.pending}
              onPress={confirmClear}
              style={styles.textAction}
            >
              <AppText color="muted" variant="caption">
                Esvaziar
              </AppText>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
      {hasItems ? (
        <View style={styles.summary}>
          <View style={styles.totalRow}>
            <AppText color="muted">Total dos produtos</AppText>
            <AppText variant="heading3" style={styles.total}>
              {formatPrice(cart.data.cart.total_amount)}
            </AppText>
          </View>
          <AppText color="muted" variant="caption">
            Entrega calculada na próxima etapa.
          </AppText>
          <Button
            fullWidth
            label="Continuar compra"
            disabled={cart.pending || Boolean(cart.error)}
            onPress={() => router.push('/(customer)/checkout')}
          />
        </View>
      ) : null}
    </Screen>
  );
}

/** Apresenta estados vazios sem cartões ou ações que não se aplicam ao utilizador. */
function CartEmpty({ title, description, onBrowse }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name="bag-handle-outline" size={38} color={colors.primary} />
      </View>
      <AppText variant="heading2" style={styles.centered}>
        {title}
      </AppText>
      <AppText color="muted" style={styles.centered}>
        {description}
      </AppText>
      {onBrowse ? <Button label="Explorar produtos" onPress={onBrowse} /> : null}
    </View>
  );
}

/** Alinha imagem, identificação e preço; edição e remoção ficam numa única linha inferior. */
function CartItem({ item }) {
  const router = useRouter();
  const cart = useCart();
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [error, setError] = useState('');
  const stock = Number(item.available_quantity) || 0;
  const dirty = quantity !== String(item.quantity);
  const attributes =
    (item.variant?.values || [])
      .map((value) => `${value.feature || 'Opção'}: ${value.value}`)
      .join(' · ') || item.variant?.sku;

  /** Confirma a quantidade no servidor e mantém o valor original se a alteração for rejeitada. */
  async function update() {
    setError('');
    try {
      const amount = validQuantity(quantity);
      if (amount > stock) throw new Error('A quantidade solicitada ultrapassa o stock disponível.');
      await cart.updateItem(item.id, amount);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  /** A imagem e o nome substituem o botão adicional de abertura do detalhe. */
  function openProduct() {
    router.push({
      pathname: '/(customer)/product/[productId]',
      params: { productId: String(item.product.id) },
    });
  }

  /** Exige confirmação antes de eliminar uma linha do carrinho. */
  function confirmRemove() {
    Alert.alert('Remover produto', `Remover ${item.product.name} do carrinho?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: () => cart.removeItem(item.id).catch(() => {}),
      },
    ]);
  }

  return (
    <View style={styles.item}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ver ${item.product.name}`}
        onPress={openProduct}
        style={styles.productRow}
      >
        <ProductImage path={item.product.image} label={item.product.name} style={styles.image} />
        <View style={styles.productInfo}>
          <AppText variant="bodyStrong" numberOfLines={2}>
            {item.product.name}
          </AppText>
          {attributes ? (
            <AppText color="muted" variant="caption" numberOfLines={2}>
              {attributes}
            </AppText>
          ) : null}
          <AppText variant="bodyStrong" color="primary">
            {formatPrice(item.observed_unit_price)}{' '}
            <AppText color="muted" variant="caption">
              / un.
            </AppText>
          </AppText>
        </View>
      </Pressable>
      <View style={styles.itemActions}>
        <View style={styles.stepper}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Diminuir quantidade de ${item.product.name}`}
            disabled={cart.pending || Number(quantity) <= 1 || !Number.isInteger(Number(quantity))}
            onPress={() => setQuantity(String(Number(quantity) - 1))}
            style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
          >
            <Ionicons
              name="remove"
              size={18}
              color={cart.pending || Number(quantity) <= 1 ? colors.disabled : colors.text}
            />
          </Pressable>
          <TextInput
            accessibilityLabel={`Quantidade de ${item.product.name}`}
            keyboardType="number-pad"
            returnKeyType="done"
            value={quantity}
            onChangeText={setQuantity}
            onSubmitEditing={update}
            editable={!cart.pending}
            maxLength={9}
            selectTextOnFocus
            style={styles.quantity}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Aumentar quantidade de ${item.product.name}`}
            disabled={
              cart.pending || Number(quantity) >= stock || !Number.isInteger(Number(quantity))
            }
            onPress={() => setQuantity(String(Number(quantity) + 1))}
            style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
          >
            <Ionicons
              name="add"
              size={18}
              color={cart.pending || Number(quantity) >= stock ? colors.disabled : colors.text}
            />
          </Pressable>
        </View>
        {dirty || item.price_changed ? (
          <Pressable
            accessibilityRole="button"
            disabled={cart.pending || stock < 1}
            onPress={update}
            style={styles.saveAction}
          >
            <AppText color="primary" variant="caption">
              Guardar
            </AppText>
          </Pressable>
        ) : null}
        <View style={styles.actionSpacer} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remover ${item.product.name}`}
          disabled={cart.pending}
          onPress={confirmRemove}
          style={styles.iconAction}
        >
          <Ionicons name="trash-outline" size={19} color={colors.textMuted} />
        </Pressable>
      </View>
      {item.price_changed ? (
        <AppText color="danger" variant="caption">
          Preço atualizado para {formatPrice(item.current_unit_price)}. Toque em Guardar para
          confirmar.
        </AppText>
      ) : null}
      {Number(item.quantity) > stock ? (
        <AppText color="danger" variant="caption">
          {stock > 0
            ? `Apenas ${stock} unidades disponíveis. Ajuste a quantidade.`
            : 'Produto sem stock. Remova-o para continuar.'}
        </AppText>
      ) : null}
      {error ? (
        <AppText color="danger" variant="caption">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

// Superfícies simples, separadores discretos e larguras flexíveis evitam desalinhamentos.
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  headerText: { flex: 1, minWidth: 0, gap: spacing.xs },
  iconAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.md, gap: spacing.md, paddingBottom: spacing.lg },
  store: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  storeHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  storeIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  item: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  productRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  image: { width: 76, height: 84, borderRadius: radii.sm, overflow: 'hidden' },
  productInfo: { flex: 1, minWidth: 0, gap: spacing.xs },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  stepButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: colors.primarySoft },
  quantity: {
    width: 46,
    height: 44,
    padding: 0,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  saveAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.xs },
  actionSpacer: { flex: 1 },
  storeFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    padding: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  textAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  summary: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  totalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  total: { flexShrink: 1 },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.dangerSoft,
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radii.sm,
  },
  noticeText: { flex: 1, minWidth: 0 },
  retry: { minHeight: 44, justifyContent: 'center' },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: { textAlign: 'center' },
  initialLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
});
