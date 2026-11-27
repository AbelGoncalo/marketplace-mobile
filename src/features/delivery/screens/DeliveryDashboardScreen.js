import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useAuth } from '@/features/auth/context/AuthContext';
import { AppText, Button, Screen } from '@/shared/ui';
import { colors, radii, spacing } from '@/theme';

/** Cada cartão abre uma lista já existente; o painel não duplica consultas nem estados. */
const dashboardShortcuts = [
  {
    label: 'Entregas',
    description: 'Recolhas e entregas atribuídas',
    icon: 'cube-outline',
    route: '/(delivery)/delivery/deliveries',
  },
  {
    label: 'Devoluções',
    description: 'Recolhas reversas atribuídas',
    icon: 'return-down-back-outline',
    route: '/(delivery)/delivery/returns',
  },
];

/** Vista inicial do Entregador: cartões de navegação e terminar sessão. */
export function DeliveryDashboardScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { width, fontScale } = useWindowDimensions();
  const [leaving, setLeaving] = useState(false);
  /** Uma coluna em ecrãs estreitos ou com texto ampliado, sem truncar os cartões. */
  const singleColumn = width < 360 || fontScale > 1.2;

  /** Bloqueia toques repetidos; uma falha apresenta o erro sem sair do painel. */
  async function leaveDashboard() {
    if (leaving) return;
    setLeaving(true);
    try {
      await signOut();
      router.replace('/(customer)/(tabs)');
    } catch (error) {
      Alert.alert('Não foi possível terminar sessão', error.message);
    } finally {
      setLeaving(false);
    }
  }

  return (
    <Screen scroll padded={false} contentStyle={styles.screen}>
      <View style={styles.header}>
        <AppText color="accent" variant="overline">
          ÁREA DO ENTREGADOR
        </AppText>
        <AppText color="inverse" variant="heading1">
          As suas tarefas
        </AppText>
        <AppText color="inverse" style={styles.headerDescription}>
          Recolhas, entregas e devoluções atribuídas a si.
        </AppText>
      </View>
      <View style={styles.content}>
        <View style={styles.section}>
          <AppText color="muted" variant="overline">
            Operação
          </AppText>
          {/* Grelha com a mesma base dos mini cartões de Compras do perfil do Cliente. */}
          <View style={styles.grid}>
            {dashboardShortcuts.map((item) => (
              <Pressable
                key={item.route}
                accessibilityRole="button"
                accessibilityLabel={`${item.label}. ${item.description}`}
                onPress={() => router.push(item.route)}
                style={({ pressed }) => [
                  styles.card,
                  singleColumn && styles.cardWide,
                  pressed && styles.cardPressed,
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardIcon}>
                    <Ionicons name={item.icon} size={22} color={colors.primary} />
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </View>
                <View style={styles.cardText}>
                  <AppText variant="bodyStrong">{item.label}</AppText>
                  <AppText color="muted" variant="caption">
                    {item.description}
                  </AppText>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
        <Button
          label="Terminar sessão"
          variant="outline"
          fullWidth
          disabled={leaving}
          onPress={leaveDashboard}
        />
      </View>
    </Screen>
  );
}

// Estrutura e estilos alinhados com os mini cartões do perfil; escala com o texto ampliado.
const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background },
  header: {
    backgroundColor: colors.primaryDark,
    gap: spacing.sm,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  headerDescription: { opacity: 0.78 },
  content: { gap: spacing.lg, padding: spacing.md },
  section: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'stretch' },
  card: {
    flexBasis: '46%',
    flexGrow: 1,
    minWidth: 0,
    minHeight: 144,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  cardWide: { flexBasis: '100%' },
  cardPressed: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { gap: spacing.xxs },
});
