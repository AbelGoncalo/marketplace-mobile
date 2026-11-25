import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/features/auth/context/AuthContext';
import { useSuperAdminResource } from '@/features/management/hooks/useSuperAdminResource';
import { getMerchants, getProducts, getStores } from '@/features/management/services/superAdminApi';
import { AppText, Button, Card, Input, LoadingState, Screen } from '@/shared/ui';
import { colors, radii, spacing } from '@/theme';

const resources = {
  stores: {
    title: 'Lojas',
    singular: 'loja',
    subtitle: 'Acompanhe as lojas distribuídas pelos centros comerciais.',
    searchPlaceholder: 'Pesquisar loja nesta página',
    loader: getStores,
    searchText: (store) => [store.name, store.shopping_center?.name, store.category?.name],
    renderCard: (store) => <StoreCard item={store} />,
  },
  merchants: {
    title: 'Lojistas',
    singular: 'lojista',
    subtitle: 'Consulte os responsáveis pelas lojas e os respetivos contactos.',
    searchPlaceholder: 'Pesquisar lojista nesta página',
    loader: getMerchants,
    searchText: (merchant) => {
      const profile = merchant.person || merchant.entity;
      return [profile?.name, profile?.email, profile?.phone];
    },
    renderCard: (merchant) => <MerchantCard item={merchant} />,
  },
  products: {
    title: 'Produtos',
    singular: 'produto',
    subtitle: 'Observe o catálogo, os lojistas e as lojas onde cada produto aparece.',
    searchPlaceholder: 'Pesquisar produto nesta página',
    loader: getProducts,
    searchText: (product) => [
      product.name,
      product.subcategory?.name,
      product.subcategory?.category?.name,
    ],
    renderCard: (product) => <ProductCard item={product} />,
  },
};

export function StoresScreen() {
  return <ResourceScreen resource="stores" />;
}

export function MerchantsScreen() {
  return <ResourceScreen resource="merchants" />;
}

export function ProductsScreen() {
  return <ResourceScreen resource="products" />;
}

/** Estrutura comum das três consultas; os cartões continuam específicos por domínio. */
function ResourceScreen({ resource }) {
  const router = useRouter();
  const { session } = useAuth();
  const config = resources[resource];
  const { error, isLoading, items, load, total } = useSuperAdminResource(
    session.token,
    config.loader,
  );
  const [search, setSearch] = useState('');

  const visibleItems = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt');
    if (!term) return items;
    return items.filter((item) =>
      config
        .searchText(item)
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase('pt').includes(term)),
    );
  }, [config, items, search]);

  return (
    <Screen contentStyle={styles.screen} scroll safeAreaColor={colors.primaryDark}>
      <View style={styles.header}>
        <Button label="Voltar" onPress={() => router.back()} variant="outline" />
        <AppText color="accent" variant="overline">
          SUPERVISÃO · SOMENTE LEITURA
        </AppText>
        <AppText color="inverse" variant="heading1">
          {config.title}
        </AppText>
        <AppText color="inverse" style={styles.subtitle}>
          {config.subtitle}
        </AppText>
      </View>

      <View style={styles.content}>
        <View style={styles.summary}>
          <AppText variant="heading2">{total}</AppText>
          <AppText color="muted">
            {total === 1 ? config.singular : config.title.toLocaleLowerCase('pt')} registados
          </AppText>
        </View>
        <Input
          leftElement={<Ionicons color={colors.textMuted} name="search" size={20} />}
          onChangeText={setSearch}
          placeholder={config.searchPlaceholder}
          value={search}
        />

        {isLoading ? (
          <LoadingState message={`A carregar ${config.title.toLowerCase()}...`} />
        ) : null}
        {error ? (
          <Card style={styles.feedback}>
            <AppText color="danger" variant="bodyStrong">
              {error}
            </AppText>
            <Button label="Tentar novamente" onPress={load} variant="outline" />
          </Card>
        ) : null}
        {!isLoading && !error && visibleItems.length === 0 ? (
          <Card style={styles.feedback}>
            <AppText color="muted">Nenhum resultado encontrado.</AppText>
          </Card>
        ) : null}

        {visibleItems.map((item) => (
          <View key={item.id}>{config.renderCard(item)}</View>
        ))}
      </View>
    </Screen>
  );
}

function StoreCard({ item }) {
  const merchant = item.supplier_store?.supplier;
  const merchantName = merchant?.person?.name || merchant?.entity?.name || 'Sem lojista associado';

  return (
    <ResourceCard icon="storefront-outline" item={item} title={item.name}>
      <InfoRow
        icon="business-outline"
        text={item.shopping_center?.name || 'Sem centro comercial'}
      />
      <InfoRow
        icon="grid-outline"
        text={
          [item.section?.name, item.category?.name].filter(Boolean).join(' · ') ||
          'Setor não informado'
        }
      />
      <InfoRow icon="person-outline" text={merchantName} />
    </ResourceCard>
  );
}

function MerchantCard({ item }) {
  const profile = item.person || item.entity;
  const access = profile?.users?.[0]?.access;
  const stores = item.supplier_stores || [];
  const storeNames = stores.map((assignment) => assignment.store?.name).filter(Boolean);

  return (
    <ResourceCard icon="people-outline" item={item} title={profile?.name || `Lojista #${item.id}`}>
      <InfoRow
        icon="mail-outline"
        text={access?.email || profile?.email || 'Email não informado'}
      />
      <InfoRow
        icon="call-outline"
        text={access?.phone || profile?.phone || 'Telefone não informado'}
      />
      <InfoRow
        icon="storefront-outline"
        text={storeNames.length ? storeNames.join(', ') : 'Sem lojas associadas'}
      />
    </ResourceCard>
  );
}

function ProductCard({ item }) {
  const supplier = item.supplier;
  const supplierName = supplier?.person?.name || supplier?.entity?.name || 'Lojista não informado';
  const stores = (item.store_products || []).map((entry) => entry.store?.name).filter(Boolean);
  const category = [item.subcategory?.category?.name, item.subcategory?.name]
    .filter(Boolean)
    .join(' · ');

  return (
    <ResourceCard icon="cube-outline" item={item} title={item.name}>
      <InfoRow icon="pricetag-outline" text={category || 'Categoria não informada'} />
      <InfoRow icon="person-outline" text={supplierName} />
      <InfoRow
        icon="storefront-outline"
        text={stores.length ? stores.join(', ') : 'Sem lojas associadas'}
      />
    </ResourceCard>
  );
}

function ResourceCard({ children, icon, item, title }) {
  return (
    <Card style={styles.resourceCard}>
      <View style={styles.cardTop}>
        <View style={styles.resourceIcon}>
          <Ionicons color={colors.primary} name={icon} size={23} />
        </View>
        <View style={styles.cardTitle}>
          <AppText variant="heading3">{title}</AppText>
          <View style={[styles.status, item.status ? styles.active : styles.inactive]}>
            <AppText color={item.status ? 'primary' : 'danger'} variant="caption">
              {item.status ? 'Ativo' : 'Inativo'}
            </AppText>
          </View>
        </View>
      </View>
      {children}
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
  resourceCard: { gap: spacing.md },
  cardTop: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  resourceIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  cardTitle: { alignItems: 'flex-start', flex: 1, gap: spacing.xs },
  status: { borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs },
  active: { backgroundColor: colors.primarySoft },
  inactive: { backgroundColor: colors.dangerSoft },
  infoRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  infoText: { flex: 1 },
});
