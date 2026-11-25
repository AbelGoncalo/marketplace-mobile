import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/features/auth/context/AuthContext';
import { useShoppingCenterDetail } from '@/features/management/hooks/useShoppingCenterDetail';
import { AppText, Button, Card, LoadingState, Screen } from '@/shared/ui';
import { colors, radii, spacing } from '@/theme';

const summaryDefinitions = [
  { key: 'stores', label: 'Lojas', icon: 'storefront-outline' },
  { key: 'available_stores', label: 'Disponíveis', icon: 'key-outline' },
  { key: 'occupied_stores', label: 'Ocupadas', icon: 'lock-closed-outline' },
  { key: 'merchants', label: 'Lojistas', icon: 'people-outline' },
  { key: 'products', label: 'Produtos', icon: 'cube-outline' },
  { key: 'active_sections', label: 'Sectores ativos', icon: 'grid-outline' },
];

/** Detalhe operacional construído a partir de um único endpoint de dashboard. */
export function ShoppingCenterDetailScreen() {
  const router = useRouter();
  const { centerId } = useLocalSearchParams();
  const { session } = useAuth();
  const { dashboard, error, isLoading, loadDashboard } = useShoppingCenterDetail(
    session.token,
    centerId,
  );

  const center = dashboard?.shopping_center;
  const summary = dashboard?.summary || {};

  return (
    <Screen contentStyle={styles.screen} scroll safeAreaColor={colors.primaryDark}>
      <View style={styles.header}>
        <Button label="Voltar" onPress={() => router.back()} variant="outline" />
        <AppText color="accent" variant="overline">
          VISÃO DO CENTRO
        </AppText>
        <AppText color="inverse" variant="heading1">
          {center?.name || 'Centro comercial'}
        </AppText>
        {center ? <CenterLocation center={center} /> : null}
      </View>

      <View style={styles.content}>
        {isLoading ? <LoadingState message="A carregar indicadores..." /> : null}
        {error ? (
          <Card style={styles.feedback}>
            <AppText color="danger" variant="bodyStrong">
              {error}
            </AppText>
            <Button label="Tentar novamente" onPress={loadDashboard} variant="outline" />
          </Card>
        ) : null}

        {dashboard ? (
          <>
            <View style={styles.sectionHeading}>
              <AppText variant="heading2">Resumo operacional</AppText>
              <AppText color="muted">Dados atuais deste centro.</AppText>
            </View>
            <View style={styles.metrics}>
              {summaryDefinitions.map((item) => (
                <Card key={item.key} style={styles.metricCard}>
                  <Ionicons color={colors.primary} name={item.icon} size={21} />
                  <AppText variant="heading1">{Number(summary[item.key]) || 0}</AppText>
                  <AppText color="muted" variant="caption">
                    {item.label}
                  </AppText>
                </Card>
              ))}
            </View>
            <SectionList sections={dashboard.sections || []} />
            <RecentStores stores={dashboard.recent_stores || []} />
          </>
        ) : null}
      </View>
    </Screen>
  );
}

function CenterLocation({ center }) {
  const municipality = center.address?.municipality;
  const location = [municipality?.name, municipality?.province?.name].filter(Boolean).join(', ');
  return (
    <View style={styles.headerLocation}>
      <Ionicons color={colors.textOnPrimary} name="location-outline" size={17} />
      <AppText color="inverse">{location || 'Localização não informada'}</AppText>
    </View>
  );
}

function SectionList({ sections }) {
  return (
    <View style={styles.block}>
      <AppText variant="heading2">Sectores</AppText>
      {sections.length ? (
        sections.map((section) => (
          <Card key={section.id} style={styles.rowCard}>
            <View style={styles.rowText}>
              <AppText variant="bodyStrong">{section.name}</AppText>
              <AppText color="muted" variant="caption">
                {section.category?.name || 'Sem categoria'} · {section.stores_count || 0} lojas
              </AppText>
            </View>
            <View
              style={[
                styles.dot,
                { backgroundColor: section.status ? colors.success : colors.disabled },
              ]}
            />
          </Card>
        ))
      ) : (
        <AppText color="muted">Nenhum sector registado.</AppText>
      )}
    </View>
  );
}

function RecentStores({ stores }) {
  return (
    <View style={styles.block}>
      <AppText variant="heading2">Lojas recentes</AppText>
      {stores.length ? (
        stores.map((store) => (
          <Card key={store.id} style={styles.rowCard}>
            <View style={styles.storeIcon}>
              <Ionicons color={colors.primary} name="storefront-outline" size={20} />
            </View>
            <View style={styles.rowText}>
              <AppText variant="bodyStrong">{store.name}</AppText>
              <AppText color="muted" variant="caption">
                {store.section?.name || 'Sem sector'} · {store.category?.name || 'Sem categoria'}
              </AppText>
            </View>
          </Card>
        ))
      ) : (
        <AppText color="muted">Ainda não existem lojas recentes.</AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, padding: 0 },
  header: {
    backgroundColor: colors.primaryDark,
    gap: spacing.sm,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  headerLocation: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, opacity: 0.8 },
  content: { gap: spacing.lg, padding: spacing.md },
  feedback: { alignItems: 'flex-start', gap: spacing.md },
  sectionHeading: { gap: spacing.xs },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metricCard: { gap: spacing.xs, width: '47%' },
  block: { gap: spacing.md },
  rowCard: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  rowText: { flex: 1, gap: spacing.xxs },
  dot: { borderRadius: radii.pill, height: 10, width: 10 },
  storeIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.sm,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
});
