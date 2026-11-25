import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/shared/ui/AppText';
import { colors, radii } from '@/theme';

/** Ação compacta para barras superiores, com contador opcional. */
export function IconButton({ icon, label, count, onPress, inverse = false }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, inverse && styles.inverse, pressed && styles.pressed]}
    >
      <Ionicons color={inverse ? colors.textOnPrimary : colors.primary} name={icon} size={23} />
      {count !== undefined ? (
        <View style={styles.counter}>
          <AppText style={styles.counterText} variant="caption">
            {count > 9 ? '9+' : count}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  inverse: { backgroundColor: 'rgba(255,255,255,0.12)' },
  pressed: { opacity: 0.68, transform: [{ scale: 0.96 }] },
  counter: {
    alignItems: 'center',
    backgroundColor: colors.danger,
    borderColor: colors.primary,
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 20,
    justifyContent: 'center',
    minWidth: 20,
    paddingHorizontal: 3,
    position: 'absolute',
    right: -2,
    top: -3,
  },
  counterText: { color: colors.textOnPrimary, fontSize: 9, fontWeight: '800', lineHeight: 12 },
});
