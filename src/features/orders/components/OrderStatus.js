import { StyleSheet, View } from 'react-native';

import { orderStatus } from '@/features/orders/utils/orderPresentation';
import { Badge } from '@/shared/ui';
import { spacing } from '@/theme';

/** Mostra apenas os dois estados essenciais, com quebra de linha em ecrãs pequenos. */
export function OrderStatus({ order, payment }) {
  return (
    <View style={styles.row}>
      <Badge {...orderStatus(order)} />
      <Badge {...orderStatus(payment, true)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
