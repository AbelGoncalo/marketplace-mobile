import { StyleSheet, View } from 'react-native';

import { ProductImage } from '@/features/catalog/components/ProductImage';
import { AppText } from '@/shared/ui';
import { radii, spacing } from '@/theme';

/** Mostra o produto histórico sem depender de continuar disponível no catálogo. */
export function ReturnProduct({ product, store, children }) {
  return (
    <View style={styles.row}>
      <ProductImage path={product?.image} label={product?.name || 'Produto'} style={styles.image} />
      <View style={styles.content}>
        <AppText variant="bodyStrong">{product?.name || 'Produto'}</AppText>
        {store ? (
          <AppText variant="caption" color="muted">
            {store}
          </AppText>
        ) : null}
        {children}
      </View>
    </View>
  );
}

// A miniatura mantém dimensões fixas e o texto usa a largura restante.
const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  image: { width: 56, height: 64, borderRadius: radii.sm },
  content: { flex: 1, minWidth: 0, gap: spacing.xs },
});
