import { StyleSheet, View } from 'react-native';

import { AppText } from '@/shared/ui/AppText';
import { colors, radii, spacing } from '@/theme';

const variants = {
  info: { backgroundColor: colors.primarySoft, color: 'primary' },
  promotion: { backgroundColor: colors.dangerSoft, color: 'danger' },
  success: { backgroundColor: colors.successSoft, color: 'default' },
  warning: { backgroundColor: colors.warningSoft, color: 'default' },
};

export function Badge({ label, variant = 'info' }) {
  const visual = variants[variant];

  return (
    <View style={[styles.badge, { backgroundColor: visual.backgroundColor }]}>
      <AppText color={visual.color} variant="caption">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
