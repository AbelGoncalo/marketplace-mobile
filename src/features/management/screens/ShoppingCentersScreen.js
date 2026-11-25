import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/features/auth/context/AuthContext';
import { useShoppingCenters } from '@/features/management/hooks/useShoppingCenters';
import { AppText, Button, Card, Input, LoadingState, Screen } from '@/shared/ui';
import { colors, radii, spacing } from '@/theme';

/** Lista de supervisão: consulta resumida, sem operações estruturais do painel web. */
export function ShoppingCentersScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { centers, error, isLoading, loadCenters, total } = useShoppingCenters(session.token);
  const [search, setSearch] = useState('');

  // useMemo recalcula o filtro somente quando a lista ou o texto pesquisado muda.
  const visibleCenters = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt');
    if (!term) return centers;
    return centers.filter((center) => center.name?.toLocaleLowerCase('pt').includes(term));
  }, [centers, search]);

  return (
    <Screen contentStyle={styles.screen} scroll safeAreaColor={colors.primaryDark}>
      <View style={styles.header}>
        <Button label="Voltar" onPress={() => router.back()} variant="outline" />
        <AppText color="accent" variant="overline">
          SUPER-ADMIN
        </AppText>
        <AppText color="inverse" variant="heading1">
          Centros comerciais
        </AppText>
        <AppText color="inverse" style={styles.subtitle}>
          Consulte estado, localização e responsável de cada centro.
        </AppText>
      </View>

      <View style={styles.content}>
        <View style={styles.summary}>
          <AppText variant="heading2">{total}</AppText>
          <AppText color="muted">centros registados</AppText>
        </View>
        <Input
          leftElement={<Ionicons color={colors.textMuted} name="search" size={20} />}
          onChangeText={setSearch}
          placeholder="Pesquisar nesta página"
          value={search}
        />

        {isLoading ? <LoadingState message="A carregar centros..." /> : null}
        {error ? (
          <Card style={styles.feedback}>
            <AppText color="danger" variant="bodyStrong">
              {error}
            </AppText>
            <Button label="Tentar novamente" onPress={loadCenters} variant="outline" />
          </Card>
        ) : null}
        {!isLoading && !error && visibleCenters.length === 0 ? (
          <Card style={styles.feedback}>
            <AppText color="muted">Nenhum centro encontrado.</AppText>
          </Card>
        ) : null}

        {visibleCenters.map((center) => (
          <ShoppingCenterCard
            center={center}
            key={center.id}
            onPress={() =>
              router.push({
                pathname: '/(super-admin)/super-admin/center/[centerId]',
                params: { centerId: center.id },
              })
            }
          />
        ))}
      </View>
    </Screen>
  );
}

/** Converte os relacionamentos aninhados da API em informação legível no cartão. */
function ShoppingCenterCard({ center, onPress }) {
  const municipality = center.address?.municipality;
  const location = [municipality?.name, municipality?.province?.name].filter(Boolean).join(', ');
  const administrator = center.admin?.person?.name || center.admin?.access?.email;

  return (
    <Card onPress={onPress} style={styles.centerCard}>
      <View style={styles.cardTop}>
        <View style={styles.centerIcon}>
          <Ionicons color={colors.primary} name="business" size={23} />
        </View>
        <View style={styles.centerTitle}>
          <AppText variant="heading3">{center.name}</AppText>
          <View style={[styles.status, center.status ? styles.active : styles.inactive]}>
            <AppText color={center.status ? 'primary' : 'danger'} variant="caption">
              {center.status ? 'Ativo' : 'Inativo'}
            </AppText>
          </View>
        </View>
      </View>
      <InfoRow icon="location-outline" text={location || 'Localização não informada'} />
      <InfoRow icon="person-outline" text={administrator || 'Sem administrador atribuído'} />
      <InfoRow icon="call-outline" text={center.phone || 'Telefone não informado'} />
      <View style={styles.openDetail}>
        <AppText color="primary" variant="bodyStrong">
          Ver indicadores
        </AppText>
        <Ionicons color={colors.primary} name="arrow-forward" size={19} />
      </View>
    </Card>
  );
}

function InfoRow({ icon, text }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons color={colors.textMuted} name={icon} size={17} />
      <AppText color="muted" style={styles.infoText}>
        {text}
      </AppText>
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
  subtitle: { opacity: 0.78 },
  content: { gap: spacing.md, padding: spacing.md },
  summary: { alignItems: 'baseline', flexDirection: 'row', gap: spacing.sm },
  feedback: { alignItems: 'flex-start', gap: spacing.md },
  centerCard: { gap: spacing.md },
  cardTop: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  centerIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  centerTitle: { alignItems: 'flex-start', flex: 1, gap: spacing.xs },
  status: { borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs },
  active: { backgroundColor: colors.primarySoft },
  inactive: { backgroundColor: colors.dangerSoft },
  infoRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  infoText: { flex: 1 },
  openDetail: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
});
