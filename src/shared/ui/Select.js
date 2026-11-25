import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/shared/ui/AppText';
import { colors, radii, shadows, spacing } from '@/theme';

/** Seletor reutilizável que abre as opções numa folha adequada para ecrãs pequenos. */
export function Select({ label, value, options, placeholder, error, disabled, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);

  /** Aplica a escolha e fecha a folha para devolver o foco ao formulário. */
  function selectOption(nextValue) {
    onChange(nextValue);
    setIsOpen(false);
  }

  return (
    <View style={styles.wrapper}>
      {label ? <AppText variant="bodyStrong">{label}</AppText> : null}
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => setIsOpen(true)}
        style={[styles.field, error && styles.fieldError, disabled && styles.disabled]}
      >
        <AppText color={selectedOption ? 'default' : 'muted'} style={styles.value}>
          {selectedOption?.label || placeholder}
        </AppText>
        <MaterialCommunityIcons color={colors.textMuted} name="chevron-down" size={22} />
      </Pressable>
      {error ? (
        <AppText color="danger" variant="caption">
          {error}
        </AppText>
      ) : null}

      <Modal
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
        transparent
        visible={isOpen}
      >
        <Pressable onPress={() => setIsOpen(false)} style={styles.backdrop}>
          <Pressable style={styles.sheet}>
            <View style={styles.handle} />
            <AppText variant="heading3">{label || 'Escolha uma opção'}</AppText>
            <ScrollView
              style={styles.optionList}
              contentContainerStyle={styles.options}
              keyboardShouldPersistTaps="handled"
            >
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => selectOption(option.value)}
                    style={[styles.option, isSelected && styles.optionSelected]}
                  >
                    <AppText
                      style={styles.optionLabel}
                      variant={isSelected ? 'bodyStrong' : 'body'}
                    >
                      {option.label}
                    </AppText>
                    {isSelected ? (
                      <MaterialCommunityIcons
                        color={colors.primary}
                        name="check-circle"
                        size={22}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  field: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 50,
    paddingHorizontal: spacing.md,
  },
  fieldError: { borderColor: colors.danger },
  disabled: { backgroundColor: colors.background, opacity: 0.6 },
  value: { flex: 1 },
  backdrop: { backgroundColor: 'rgba(7, 11, 37, 0.58)', flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    ...shadows.floating,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: colors.border,
    borderRadius: radii.pill,
    height: 4,
    width: 44,
  },
  // A lista pode crescer sem empurrar categorias para fora do ecrã.
  optionList: { maxHeight: 320 },
  options: { gap: spacing.sm },
  option: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  // Textos longos quebram dentro da opção sem deslocar o indicador de seleção.
  optionLabel: { flex: 1, minWidth: 0 },
  optionSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
});
