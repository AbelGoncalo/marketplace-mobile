import Ionicons from '@expo/vector-icons/Ionicons';
import { FavoriteButton } from '@/features/favorites/components/FavoriteButton';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AddToCartControls } from '@/features/cart/components/AddToCartControls';
import { ProductImage } from '@/features/catalog/components/ProductImage';
import { QueryFeedback } from '@/features/catalog/components/QueryFeedback';
import { getCatalogProduct } from '@/features/catalog/services/catalogApi';
import {
  formatPrice,
  productPricing,
  routeValue,
} from '@/features/catalog/utils/productPresentation';
import { useApiQuery } from '@/shared/hooks/useApiQuery';
import { AppText, Badge, Card, Screen } from '@/shared/ui';
import { colors, radii, spacing } from '@/theme';

/** Consulta o produto público e distingue produtos removidos de falhas de ligação. */
export function ProductDetailScreen() {
  const router = useRouter();
  const { productId } = useLocalSearchParams();
  const id = routeValue(productId);
  const loader = useCallback(() => getCatalogProduct(id), [id]);
  const query = useApiQuery(loader);

  /** Volta à origem; deep links sem histórico regressam ao catálogo. */
  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/(customer)/catalog');
  }

  return (
    <Screen scroll contentStyle={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={goBack}
          style={styles.headerButton}
        >
          <Ionicons name="arrow-back" size={23} color={colors.text} />
        </Pressable>
        <AppText variant="bodyStrong" style={styles.headerTitle}>
          Detalhe do produto
        </AppText>
      </View>
      <QueryFeedback
        {...query}
        empty={!query.data}
        emptyMessage="Este produto já não está disponível."
        onRetry={query.refresh}
      />
      {query.data ? <ProductContent key={id} product={query.data} /> : null}
    </Screen>
  );
}

/** Apresenta imagens e disponibilidades por loja sem misturar os preços das variantes. */
function ProductContent({ product }) {
  const images = [
    ...new Set(
      [product.image, ...(product.images || []).map((image) => image.path)].filter(Boolean),
    ),
  ];
  const [selectedImage, setSelectedImage] = useState(images[0]);
  const pricing = productPricing(product.price_from, product.promotional_price_from);
  return (
    <>
      {/* A imagem mantém fundo neutro e proporção confortável; o contador identifica a seleção. */}
      <View style={styles.imageStage}>
        <ProductImage path={selectedImage} label={product.name} style={styles.heroImage} />
        {images.length > 1 ? (
          <View style={styles.imageCount}>
            <AppText variant="caption">
              {images.indexOf(selectedImage) + 1} / {images.length}
            </AppText>
          </View>
        ) : null}
      </View>
      {images.length > 1 ? (
        <ScrollView horizontal contentContainerStyle={styles.gallery}>
          {images.map((path, index) => (
            <Pressable
              key={path}
              accessibilityRole="button"
              accessibilityLabel={`Ver imagem ${index + 1}`}
              accessibilityState={{ selected: selectedImage === path }}
              onPress={() => setSelectedImage(path)}
              style={[styles.thumbnail, selectedImage === path && styles.selected]}
            >
              <ProductImage
                path={path}
                label={`Imagem ${index + 1} de ${product.name}`}
                style={styles.thumbnailImage}
              />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <View style={styles.summary}>
        <AppText variant="caption" color="muted">
          {product.category?.name || 'Catálogo'}
          {product.subcategory?.name ? ` / ${product.subcategory.name}` : ''}
        </AppText>
        {/* O favorito pertence ao resumo do produto, junto do nome, e não à navegação. */}
        <View style={styles.productHeading}>
          <AppText variant="heading1" style={[styles.productTitle, styles.flex]}>
            {product.name}
          </AppText>
          <View style={styles.favorite}>
            <FavoriteButton product={product.id} />
          </View>
        </View>
        {pricing.oldPrice !== null ? (
          <Badge label="Promoção disponível" variant="promotion" />
        ) : null}
        <View style={styles.priceBlock}>
          <AppText variant="caption" color="muted">
            Desde
          </AppText>
          <AppText color="primary" variant="display" style={styles.price}>
            {formatPrice(pricing.price)}
          </AppText>
        </View>
        <AppText variant="caption" color="muted">
          Escolha a loja e a variante para confirmar o preço.
        </AppText>
      </View>
      <View style={styles.sectionHeading}>
        <Ionicons name="storefront-outline" size={21} color={colors.primary} />
        <View style={styles.flex}>
          <AppText variant="heading2">Opções de compra</AppText>
          <AppText variant="caption" color="muted">
            Compare as lojas e escolha a opção pretendida.
          </AppText>
        </View>
      </View>
      {(product.variants || []).map((variant) => (
        <VariantCard key={variant.store_product_variant_id} variant={variant} />
      ))}
      {!product.variants?.length ? (
        <AppText color="muted">Sem variantes disponíveis neste momento.</AppText>
      ) : null}
      <Card style={styles.description}>
        <AppText variant="heading3">Sobre o produto</AppText>
        <AppText color="muted" style={styles.descriptionText}>
          {product.description || 'Descrição não disponível.'}
        </AppText>
      </Card>
    </>
  );
}

/** Mostra o preço, os atributos e a adição ao carrinho da oferta da loja. */
function VariantCard({ variant }) {
  const pricing = productPricing(variant.price, variant.promotional_price);
  const attributes = (variant.values || [])
    .map((item) => `${item.feature?.name || 'Opção'}: ${item.value}`)
    .join(' · ');
  const stock = Number(variant.quantity) || 0;
  return (
    <Card style={styles.variant}>
      {/* Nome e centro partilham a mesma coluna; o ícone não desloca os restantes dados. */}
      <View style={styles.storeHeader}>
        <View style={styles.storeIcon}>
          <Ionicons name="storefront-outline" size={21} color={colors.primary} />
        </View>
        <View style={styles.storeText}>
          <AppText variant="heading3">{variant.store?.name || 'Loja'}</AppText>
          {variant.store?.shopping_center?.name ? (
            <AppText variant="caption" color="muted">
              {variant.store.shopping_center.name}
            </AppText>
          ) : null}
        </View>
      </View>
      <View style={styles.optionBlock}>
        <AppText variant="caption" color="muted">
          Variante disponível
        </AppText>
        <AppText variant="bodyStrong">{attributes || variant.sku || 'Variante padrão'}</AppText>
      </View>
      <View style={styles.offerSummary}>
        <View style={styles.offerPrice}>
          <AppText variant="caption" color="muted">
            Preço nesta loja
          </AppText>
          {pricing.oldPrice !== null ? (
            <AppText variant="caption" color="muted" style={styles.oldPrice}>
              {formatPrice(pricing.oldPrice)}
            </AppText>
          ) : null}
          <AppText color="primary" variant="heading2" style={styles.priceNumber}>
            {formatPrice(pricing.price)}
          </AppText>
        </View>
        <View style={styles.stockRow}>
          <Ionicons
            name={stock > 0 ? 'checkmark-circle-outline' : 'alert-circle-outline'}
            size={16}
            color={stock > 0 ? colors.success : colors.textMuted}
          />
          <AppText variant="caption" color="muted">
            {stock > 0 ? `${stock} em stock` : 'Sem stock'}
          </AppText>
        </View>
      </View>
      <View style={styles.divider} />
      <View style={styles.purchaseActions}>
        <AddToCartControls variant={variant} />
      </View>
    </Card>
  );
}

// Superfícies leves e grupos de uma coluna distinguem produto, preço e compra sem limitar textos longos.
const styles = StyleSheet.create({
  screen: { gap: spacing.md, paddingBottom: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, minWidth: 0 },
  imageStage: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroImage: { height: 300 },
  imageCount: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  summary: { gap: spacing.sm, paddingVertical: spacing.sm },
  productTitle: { fontSize: 24, lineHeight: 31 },
  priceBlock: { gap: spacing.xs, paddingTop: spacing.sm },
  price: { fontVariant: ['tabular-nums'], fontSize: 28, lineHeight: 35 },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  flex: { flex: 1, minWidth: 0 },
  storeHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  storeIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    backgroundColor: colors.primarySoft,
  },
  optionBlock: {
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.background,
  },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  purchaseActions: { gap: spacing.sm },
  description: { gap: spacing.sm },
  descriptionText: { fontSize: 14, lineHeight: 22 },
  gallery: { gap: spacing.sm },
  thumbnail: {
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  selected: { borderColor: colors.primary },
  thumbnailImage: { width: 72, height: 72 },
  variant: { gap: spacing.md, shadowOpacity: 0, elevation: 0 },
  productHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  favorite: { flexShrink: 0 },
  storeText: { flex: 1, minWidth: 0, gap: spacing.xs },
  offerSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  offerPrice: { gap: spacing.xs, flexShrink: 1 },
  priceNumber: { fontVariant: ['tabular-nums'] },
  oldPrice: { textDecorationLine: 'line-through' },
});
