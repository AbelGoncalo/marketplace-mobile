import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { useAuth } from '@/features/auth/context/AuthContext';
import { AppText, Button, Card, Screen } from '@/shared/ui';
import { colors, radii, spacing } from '@/theme';

/** Base visual partilhada pelos painéis, mantendo menus e cabeçalho consistentes. */
export function ManagementDashboard({
  eyebrow,
  title,
  description,
  actions,
  metrics = [],
  metricsError,
  metricsLoading = false,
  onRefreshMetrics,
}) {
  const router = useRouter();
  const { session, signOut } = useAuth();

  async function leaveDashboard() {
    try {
      await signOut();
      router.replace('/(customer)/(tabs)');
    } catch (error) {
      Alert.alert('Não foi possível terminar sessão', error.message);
    }
  }

  return (
    <Screen contentStyle={styles.screen} padded={false} scroll safeAreaColor={colors.primaryDark}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.brandMark}>
            <Ionicons color={colors.textOnAccent} name="location" size={22} />
          </View>
          <AppText color="inverse" variant="bodyStrong">
            Ponto Certo
          </AppText>
        </View>
        <AppText color="accent" variant="overline">
          {eyebrow}
        </AppText>
        <AppText color="inverse" variant="heading1">
          {title}
        </AppText>
        <AppText color="inverse" style={styles.heroDescription}>
          {description}
        </AppText>
      </View>

      <View style={styles.content}>
        <View style={styles.welcome}>
          <View style={styles.avatar}>
            <Ionicons color={colors.textOnPrimary} name="person" size={22} />
          </View>
          <View style={styles.welcomeText}>
            <AppText color="muted" variant="caption">
              SESSÃO ATIVA
            </AppText>
            <AppText variant="heading3">{session.user.name}</AppText>
          </View>
        </View>

        {metricsLoading ? (
          <Card style={styles.feedbackCard}>
            <AppText color="muted">A atualizar indicadores...</AppText>
          </Card>
        ) : null}
        {metricsError ? (
          <Card style={styles.feedbackCard}>
            <AppText color="danger" variant="bodyStrong">
              Não foi possível carregar os indicadores.
            </AppText>
            <Button label="Tentar novamente" onPress={onRefreshMetrics} variant="outline" />
          </Card>
        ) : null}
        {metrics.length ? (
          <View style={styles.metrics}>
            {metrics.map((metric) => (
              <Card key={metric.label} style={styles.metricCard}>
                <Ionicons color={colors.primary} name={metric.icon} size={20} />
                <AppText variant="heading1">{metric.value}</AppText>
                <AppText color="muted" variant="caption">
                  {metric.label}
                </AppText>
              </Card>
            ))}
          </View>
        ) : null}

        <View style={styles.sectionTitle}>
          <AppText variant="heading2">Gestão rápida</AppText>
          <AppText color="muted">Escolha uma área para começar.</AppText>
        </View>
        <View style={styles.actions}>
          {actions.map((action) => (
            <Card key={action.title} onPress={action.onPress} style={styles.actionCard}>
              <View style={styles.actionIcon}>
                <Ionicons color={colors.primary} name={action.icon} size={25} />
              </View>
              <AppText variant="heading3">{action.title}</AppText>
              <AppText color="muted" variant="caption">
                {action.description}
              </AppText>
              <Ionicons
                color={colors.primary}
                name="arrow-forward"
                size={20}
                style={styles.arrow}
              />
            </Card>
          ))}
        </View>
        <Button fullWidth label="Terminar sessão" onPress={leaveDashboard} variant="outline" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background },
  hero: {
    backgroundColor: colors.primaryDark,
    gap: spacing.sm,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  heroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  heroDescription: { opacity: 0.78 },
  content: { gap: spacing.lg, padding: spacing.md },
  welcome: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: -spacing.xl,
    padding: spacing.md,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  welcomeText: { flex: 1 },
  sectionTitle: { gap: spacing.xs },
  feedbackCard: { alignItems: 'flex-start', gap: spacing.md },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metricCard: { gap: spacing.xs, width: '47%' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  actionCard: { gap: spacing.sm, minHeight: 175, width: '47%' },
  actionIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  arrow: { marginTop: 'auto' },
});
