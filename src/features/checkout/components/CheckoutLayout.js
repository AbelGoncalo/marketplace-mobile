import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { AppText, Button, Screen } from '@/shared/ui';
import { colors, radii, spacing } from '@/theme';

/** Mantém cabeçalho, conteúdo e campos alinhados, incluindo quando o teclado está aberto. */
export function CheckoutLayout({
  children,
  title = 'Finalizar compra',
  subtitle = 'Escolha a entrega e reveja os detalhes.',
  busy = false,
}) {
  const router = useRouter();
  return (
    <Screen padded={false} contentStyle={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar ao carrinho"
          disabled={busy}
          onPress={() => router.replace('/(customer)/(tabs)/cart')}
          style={styles.back}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.heading}>
          <AppText variant="heading2">{title}</AppText>
          <AppText color="muted" variant="caption">
            {subtitle}
          </AppText>
        </View>
      </View>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** Dá uma identidade visual a cada cartão e separa o cabeçalho do seu conteúdo. */
export function CheckoutSection({ title, description, icon, step, emphasized = false, children }) {
  return (
    <View style={[styles.section, emphasized && styles.sectionEmphasized]}>
      {title ? (
        <View style={styles.sectionHeader}>
          {icon || step ? (
            <View style={[styles.sectionIcon, emphasized && styles.sectionIconEmphasized]}>
              {step ? (
                <AppText color="primary" variant="bodyStrong">
                  {step}
                </AppText>
              ) : (
                <Ionicons name={icon} size={20} color={colors.primary} />
              )}
            </View>
          ) : null}
          <View style={styles.sectionHeading}>
            <AppText variant="heading3" style={styles.sectionTitle}>
              {title}
            </AppText>
            {description ? (
              <AppText color="muted" variant="caption">
                {description}
              </AppText>
            ) : null}
          </View>
        </View>
      ) : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

/** Dá contexto às mensagens e mantém o ícone alinhado com textos de várias linhas. */
export function CheckoutNotice({ children, danger = false }) {
  return (
    <View style={[styles.notice, danger && styles.dangerNotice]}>
      <Ionicons
        name={danger ? 'alert-circle-outline' : 'information-circle-outline'}
        size={20}
        color={danger ? colors.danger : colors.primary}
      />
      <AppText variant="caption" color={danger ? 'danger' : 'primary'} style={styles.noticeText}>
        {children}
      </AppText>
    </View>
  );
}

/** Usa mensagens próprias do checkout em vez de apresentar carregamento de catálogo. */
export function CheckoutFeedback({
  isLoading,
  error,
  empty,
  onRetry,
  emptyMessage = 'Sem opções disponíveis.',
}) {
  if (isLoading)
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
        <AppText color="muted" variant="caption">
          A preparar os detalhes da compra...
        </AppText>
      </View>
    );
  if (error)
    return (
      <View style={styles.group}>
        <CheckoutNotice danger>{error}</CheckoutNotice>
        <Button fullWidth label="Tentar novamente" variant="outline" onPress={onRetry} />
      </View>
    );
  if (empty) return <CheckoutNotice>{emptyMessage}</CheckoutNotice>;
  return null;
}

/** Alinha a descrição e o valor sem impedir a quebra em dispositivos estreitos. */
export function CheckoutAmount({ label, value, strong = false }) {
  return (
    <View style={[styles.amount, strong && styles.amountStrong]}>
      <AppText
        color={strong ? 'default' : 'muted'}
        variant={strong ? 'bodyStrong' : 'body'}
        style={styles.amountLabel}
      >
        {label}
      </AppText>
      <AppText
        color={strong ? 'primary' : 'default'}
        variant={strong ? 'heading2' : 'bodyStrong'}
        style={styles.amountValue}
      >
        {value}
      </AppText>
    </View>
  );
}

// Superfícies discretas e espaçamento único evitam a aparência de campos colados.
const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1, minWidth: 0, gap: spacing.xs },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.035,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 1,
  },
  sectionEmphasized: { borderColor: '#B8CAE6' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionIconEmphasized: { backgroundColor: colors.primarySoft },
  sectionHeading: { flex: 1, minWidth: 0, gap: spacing.xxs },
  sectionTitle: { fontSize: 16, lineHeight: 22 },
  sectionBody: { padding: spacing.md, gap: spacing.md },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    borderRadius: radii.sm,
    gap: spacing.sm,
  },
  dangerNotice: { backgroundColor: colors.dangerSoft },
  noticeText: { flex: 1, minWidth: 0 },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  group: { gap: spacing.sm },
  amount: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  amountLabel: { flex: 1, minWidth: 0 },
  amountValue: {
    flexShrink: 1,
    maxWidth: '68%',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  amountStrong: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginHorizontal: -spacing.sm,
  },
});
