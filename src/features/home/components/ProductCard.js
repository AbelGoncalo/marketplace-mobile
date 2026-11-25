import { StyleSheet, View } from 'react-native';

import { ProductImage } from '@/features/catalog/components/ProductImage';
import { formatPrice, productPricing } from '@/features/catalog/utils/productPresentation';
import { AppText, Badge, Card } from '@/shared/ui';
import { radii, spacing } from '@/theme';

/** Cartão público partilhado pela Home e pelo catálogo, com preços reais da API. */
export function ProductCard({ product, onPress, style }) {
  const pricing = productPricing(product.price_from, product.promotional_price_from);
  return (
    <Card
      accessibilityLabel={`Ver ${product.name}`}
      onPress={onPress}
      padding="none"
      style={[styles.card, style]}
    >
      <ProductImage path={product.image} label={product.name} />
      <View style={styles.content}>
        {pricing.oldPrice !== null ? <Badge label="Promoção" variant="promotion" /> : null}
        <AppText color="muted" variant="caption">
          {product.category?.name || 'Catálogo'}
        </AppText>
        <AppText numberOfLines={2} style={styles.productName} variant="bodyStrong">
          {product.name}
        </AppText>
        {pricing.oldPrice !== null ? (
          <AppText color="muted" style={styles.oldPrice} variant="caption">
            Desde {formatPrice(pricing.oldPrice)}
          </AppText>
        ) : null}
        <AppText color="primary" variant="bodyStrong">
          Desde {formatPrice(pricing.price)}
        </AppText>
      </View>
    </Card>
  );
}

// A largura pode ser adaptada pela grelha sem alterar os cartões horizontais da Home.
const styles = StyleSheet.create({
  card: { borderRadius: radii.lg, overflow: 'hidden', width: 184 },
  content: { padding: spacing.md, gap: spacing.xs },
  productName: { minHeight: 44 },
  oldPrice: { textDecorationLine: 'line-through' },
});
