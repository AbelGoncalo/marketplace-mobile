import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { colors, radii, spacing } from '@/theme';

/** Mantém edição direta e limites existentes, com ícones circulares alinhados ao valor. */
export function QuantityInput({
  value,
  onChange,
  maximum,
  disabled,
  canDecrease = true,
  readOnly = false,
}) {
  const current = Number(value);
  const decreaseDisabled = disabled || !canDecrease || !Number.isInteger(current) || current <= 1;
  const increaseDisabled = disabled || !Number.isInteger(current) || current >= maximum;
  return (
    <View style={styles.group}>
      <View style={styles.row}>
        <QuantityStep
          icon="remove"
          label="Diminuir quantidade"
          disabled={decreaseDisabled}
          onPress={() => onChange(String(current - 1))}
        />
        <TextInput
          accessibilityLabel="Quantidade"
          value={value}
          onChangeText={onChange}
          keyboardType="number-pad"
          maxLength={9}
          editable={!disabled && !readOnly}
          selectTextOnFocus
          style={[styles.value, disabled && styles.disabled]}
        />
        <QuantityStep
          icon="add"
          label="Aumentar quantidade"
          disabled={increaseDisabled}
          onPress={() => onChange(String(Math.max(0, current) + 1))}
        />
      </View>
    </View>
  );
}

/** A superfície circular mantém 44 pontos de toque e distingue ações indisponíveis. */
function QuantityStep({ icon, label, disabled, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.step,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={19} color={disabled ? colors.textMuted : colors.primary} />
    </Pressable>
  );
}

// O conjunto compacto deixa os três elementos no mesmo eixo, sem esticar o campo pelo cartão.
const styles = StyleSheet.create({
  group: { gap: spacing.xs, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  step: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  disabled: { opacity: 0.4 },
  value: {
    width: 64,
    minHeight: 44,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.background,
  },
});
