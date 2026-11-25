import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/features/auth/context/AuthContext';
import { useSuperAdminMetrics } from '@/features/management/hooks/useSuperAdminMetrics';
import { AppText, Button, Card, IconButton, Screen } from '@/shared/ui';
import { colors, radii, spacing } from '@/theme';

/** Painel móvel de supervisão global, exclusivo do Super-admin. */
export function SuperAdminDashboardScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const { error, isLoading, metrics, refresh } = useSuperAdminMetrics(session.token);
  const displayName =
    !session.user.name || session.user.name.includes('@') ? 'Administrador' : session.user.name;
  const actions = [
    {
      title: 'Centros comerciais',
      description: 'Consulte centros, responsáveis, estado e indicadores.',
      icon: 'business-outline',
      onPress: () => router.push('/(super-admin)/super-admin/centers'),
      available: true,
    },
    {
      title: 'Lojas',
      description: 'Acompanhe estado, centro, setor e lojista responsável.',
      icon: 'storefront-outline',
      onPress: () => router.push('/(super-admin)/super-admin/stores'),
      available: true,
    },
    {
      title: 'Lojistas',
      description: 'Consulte contactos e lojas associadas a cada lojista.',
      icon: 'people-outline',
      onPress: () => router.push('/(super-admin)/super-admin/merchants'),
      available: true,
    },
    {
      title: 'Produtos',
      description: 'Observe catálogo, categoria, lojista e pontos de venda.',
      icon: 'cube-outline',
      onPress: () => router.push('/(super-admin)/super-admin/products'),
      available: true,
    },
  ];

  async function leaveDashboard() {
    await signOut();
    router.replace('/(customer)/(tabs)');
  }

  return (
    <Screen contentStyle={styles.screen} padded={false} scroll safeAreaColor={colors.primaryDark}>
      <View style={styles.header}>
        <View style={styles.topBar}>
          <View style={styles.brand}>
            <View style={styles.brandMark}>
              <Ionicons color={colors.textOnAccent} name="shield-checkmark" size={23} />
            </View>
            <View>
              <AppText color="inverse" variant="bodyStrong">
                Ponto Certo
              </AppText>
              <AppText color="inverse" style={styles.brandCaption} variant="caption">
                Administração global
              </AppText>
            </View>
          </View>
          <View style={styles.topActions}>
            <IconButton
              icon="home-outline"
              inverse
              label="Ir para a loja"
              onPress={() => router.push('/(customer)/(tabs)')}
            />
            <IconButton
              icon="log-out-outline"
              inverse
              label="Terminar sessão"
              onPress={leaveDashboard}
            />
          </View>
        </View>

        <View style={styles.roleBadge}>
          <Ionicons color={colors.textOnAccent} name="key" size={14} />
          <AppText color="accent" variant="overline">
            SUPER ADMIN
          </AppText>
        </View>
        <AppText color="inverse" variant="display">
          Visão geral
        </AppText>
        <AppText color="inverse" style={styles.headerDescription}>
          Supervisão rápida de toda a operação do marketplace.
        </AppText>

        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Ionicons color={colors.textOnPrimary} name="person" size={22} />
          </View>
          <View style={styles.identityText}>
            <AppText color="inverse" variant="bodyStrong">
              {displayName}
            </AppText>
            <AppText color="inverse" style={styles.identityCaption} variant="caption">
              Sessão de Super-admin ativa
            </AppText>
          </View>
          <View style={styles.onlineDot} />
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.sectionHeading}>
          <View>
            <AppText variant="heading2">Indicadores</AppText>
            <AppText color="muted">Deslize para consultar</AppText>
          </View>
          <IconButton icon="refresh" label="Atualizar indicadores" onPress={refresh} />
        </View>

        {isLoading ? <AppText color="muted">A atualizar indicadores...</AppText> : null}
        {error ? (
          <Card style={styles.feedback}>
            <AppText color="danger" variant="bodyStrong">
              Não foi possível carregar os indicadores.
            </AppText>
            <Button label="Tentar novamente" onPress={refresh} variant="outline" />
          </Card>
        ) : null}
        {metrics.length ? (
          <ScrollView
            contentContainerStyle={styles.metrics}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {metrics.map((metric) => (
              <Card key={metric.label} style={styles.metricCard}>
                <View style={styles.metricIcon}>
                  <Ionicons color={colors.primary} name={metric.icon} size={22} />
                </View>
                <AppText variant="display">{metric.value}</AppText>
                <AppText color="muted" variant="bodyStrong">
                  {metric.label}
                </AppText>
              </Card>
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.sectionHeading}>
          <View>
            <AppText variant="heading2">Área de supervisão</AppText>
            <AppText color="muted">Ações pensadas para o telemóvel</AppText>
          </View>
        </View>
        <View style={styles.actionList}>
          {actions.map((action) => (
            <Card key={action.title} onPress={action.onPress} style={styles.actionCard}>
              <View style={styles.actionIcon}>
                <Ionicons color={colors.primary} name={action.icon} size={24} />
              </View>
              <View style={styles.actionText}>
                <AppText variant="heading3">{action.title}</AppText>
                <AppText color="muted" variant="caption">
                  {action.description}
                </AppText>
              </View>
              {action.available ? (
                <Ionicons color={colors.primary} name="chevron-forward" size={22} />
              ) : (
                <View style={styles.soonBadge}>
                  <AppText color="muted" variant="caption">
                    Em breve
                  </AppText>
                </View>
              )}
            </Card>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background },
  header: {
    backgroundColor: colors.primaryDark,
    gap: spacing.md,
    overflow: 'hidden',
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  brand: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  brandMark: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  brandCaption: { opacity: 0.6 },
  topActions: { flexDirection: 'row', gap: spacing.sm },
  roleBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerDescription: { maxWidth: 310, opacity: 0.72 },
  identity: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  identityText: { flex: 1 },
  identityCaption: { opacity: 0.62 },
  onlineDot: {
    backgroundColor: colors.success,
    borderColor: colors.primaryDark,
    borderRadius: radii.pill,
    borderWidth: 3,
    height: 14,
    width: 14,
  },
  content: { gap: spacing.lg, padding: spacing.md },
  sectionHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  feedback: { alignItems: 'flex-start', gap: spacing.md },
  metrics: { gap: spacing.md, paddingBottom: spacing.xs, paddingRight: spacing.md },
  metricCard: { gap: spacing.sm, minHeight: 165, width: 150 },
  metricIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  actionList: { gap: spacing.md },
  actionCard: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 92 },
  actionIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  actionText: { flex: 1, gap: spacing.xxs },
  soonBadge: {
    backgroundColor: colors.background,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
