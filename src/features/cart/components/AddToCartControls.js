import { formatPrice } from '@/features/catalog/utils/productPresentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { QuantityInput } from '@/features/cart/components/QuantityInput';
import { useCart } from '@/features/cart/context/CartContext';
import { validQuantity } from '@/features/cart/services/cartApi';
import { AppText } from '@/shared/ui';
import { colors, spacing } from '@/theme';

/** Cada toque atualiza a variante real do carrinho; o mínimo é um e a remoção fica no carrinho. */
export function AddToCartControls({ variant }) {
  const router = useRouter();
  const cart = useCart();
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const lock = useRef(false);
  const item = (cart.data?.stores || [])
    .flatMap((store) => store.items || [])
    .find(
      (entry) =>
        Number(entry.store_product_variant_id) === Number(variant.store_product_variant_id),
    );
  const quantity = item?.quantity || 1;
  const stock = Number(variant.quantity) || 0;

  /** Sem artigo, o primeiro + adiciona uma unidade; nas restantes ações envia quantidade absoluta. */
  async function change(value) {
    if (lock.current || cart.pending || uncertain || !cart.ready) return;
    lock.current = true;
    setError('');
    try {
      const amount = item ? validQuantity(value) : 1;
      if (amount > stock) throw new Error('A quantidade ultrapassa o stock disponível.');
      if (item) await cart.updateItem(item.id, amount);
      else await cart.addItem(variant.store_product_variant_id, 1);
    } catch (failure) {
      setError(failure.message);
      // Reconsulta após resposta incerta; nunca repete a alteração automaticamente.
      setUncertain(true);
      try {
        await cart.refresh();
        setUncertain(false);
      } catch {
        /* Mantém bloqueado até consulta explícita. */
      }
    } finally {
      lock.current = false;
    }
  }

  /** Acesso vazio informa o Cliente e conserva o ecrã atual. */
  function openCart() {
    if (cart.totalQuantity < 1) {
      Alert.alert('Carrinho vazio', 'Adicione pelo menos um artigo para abrir o carrinho.');
      return;
    }
    router.push('/(customer)/(tabs)/cart');
  }
  if (!cart.canShop)
    return <AppText color="muted">Utilize uma conta de Cliente para comprar.</AppText>;
  return (
    <View style={styles.controls}>
      {/* O subtotal vem da API e acompanha a quantidade confirmada, incluindo promoções atuais. */}
      {item ? (
        <View style={styles.total} accessibilityLiveRegion="polite">
          <AppText variant="caption" color="muted">
            Total deste artigo · {quantity} unidade(s)
          </AppText>
          <AppText variant="heading2" color="primary" style={styles.amount}>
            {formatPrice(item.subtotal)}
          </AppText>
          {cart.pending ? (
            <AppText variant="caption" color="muted">
              A atualizar total...
            </AppText>
          ) : null}
        </View>
      ) : null}
      <QuantityInput
        value={String(quantity)}
        onChange={change}
        maximum={!item && stock >= 1 ? Math.max(2, stock) : stock}
        disabled={cart.pending || !cart.ready || uncertain}
        canDecrease={Boolean(item)}
        readOnly
      />
      {error || cart.error ? (
        <AppText color="danger" accessibilityRole="alert">
          {error || cart.error}
        </AppText>
      ) : null}
      {!cart.ready || uncertain ? (
        <Pressable
          accessibilityRole="button"
          disabled={cart.pending}
          onPress={async () => {
            try {
              await cart.refresh();
              setUncertain(false);
              setError('');
            } catch (failure) {
              setError(failure.message);
            }
          }}
          style={styles.link}
        >
          <AppText color="primary" variant="caption">
            Atualizar carrinho
          </AppText>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ver carrinho"
        disabled={cart.pending}
        onPress={openCart}
        style={styles.link}
      >
        <AppText variant="caption" color="muted">
          Ver carrinho
        </AppText>
        <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}
// Controlos centrados mantêm a apresentação compacta sem botão adicional de gravação.
const styles = StyleSheet.create({
  controls: { alignItems: 'center', gap: spacing.sm },
  total: { alignItems: 'center', gap: spacing.xs },
  amount: { fontVariant: ['tabular-nums'], textAlign: 'center' },
  link: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
});
