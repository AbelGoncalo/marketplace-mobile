import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { useCart } from '@/features/cart/context/CartContext';
import { QueryFeedback } from '@/features/catalog/components/QueryFeedback';
import { getHomeContent } from '@/features/catalog/services/catalogApi';
import { useApiQuery } from '@/shared/hooks/useApiQuery';
import { ProductCard } from '@/features/home/components/ProductCard';
import { useAuth } from '@/features/auth/context/AuthContext';
import { getManagementRoute } from '@/features/auth/utils/accessControl';
import { BrandLogo } from '@/shared/components/BrandLogo';
import { CategoryCard } from '@/shared/components/CategoryCard';
import { AppText, Badge, Button, Card, IconButton, Input, Screen } from '@/shared/ui';
import { colors, radii, spacing } from '@/theme';

const benefits = [
  { id: 'delivery', icon: 'bicycle-outline', label: 'Entrega rápida' },
  { id: 'secure', icon: 'shield-checkmark-outline', label: 'Compra segura' },
  { id: 'stores', icon: 'storefront-outline', label: 'Lojas locais' },
];

/** Home comercial da aplicação Ponto Certo. */
export function HomeScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { totalQuantity, totalItems } = useCart();
  const [search, setSearch] = useState('');
  const managementRoute = getManagementRoute(session);
  const query = useApiQuery(getHomeContent);
  const categories = query.data?.categories || [];
  const products = query.data?.featured_products?.length
    ? query.data.featured_products
    : query.data?.new_products || [];

  /** Abre o catálogo com os filtros da ação comercial escolhida. */
  function openCatalog(params = {}) {
    router.push({ pathname: '/(customer)/catalog', params });
  }

  /** Submete a pesquisa da Home sem filtrar apenas os produtos em destaque. */
  function submitSearch() {
    openCatalog({ search: search.trim() });
  }

  return (
    <Screen
      contentStyle={styles.screenContent}
      padded={false}
      safeAreaColor={colors.primaryDark}
      scroll
    >
      <View style={styles.header}>
        <View pointerEvents="none" style={styles.headerDecoration}>
          <View style={[styles.star, styles.starOne]} />
          <View style={[styles.star, styles.starTwo]} />
          <View style={styles.headerGlow} />
        </View>
        <View style={styles.topBar}>
          <BrandLogo />
          <View style={styles.headerActions}>
            <IconButton
              icon="heart-outline"
              inverse
              label="Favoritos"
              onPress={() => router.push('/(customer)/(tabs)/favorites')}
            />
            <IconButton
              count={totalItems || undefined}
              icon="bag-handle-outline"
              inverse
              label="Carrinho"
              onPress={() => {
                // Mantém a Home quando ainda não existem artigos no carrinho.
                if (totalQuantity < 1) {
                  Alert.alert(
                    'Carrinho vazio',
                    'Adicione pelo menos um artigo para abrir o carrinho.',
                  );
                  return;
                }
                router.push('/(customer)/(tabs)/cart');
              }}
            />
          </View>
        </View>

        <View style={styles.locationRow}>
          <Ionicons color={colors.accent} name="navigate-circle" size={21} />
          <View style={styles.locationText}>
            <AppText color="inverse" style={styles.locationLabel} variant="caption">
              Entregar em
            </AppText>
            <AppText color="inverse" variant="bodyStrong">
              Luanda, Angola
            </AppText>
          </View>
          <Ionicons color={colors.textOnPrimary} name="chevron-down" size={17} />
        </View>
      </View>

      <View style={styles.searchWrapper}>
        <Input
          leftElement={<Ionicons color={colors.primary} name="search" size={22} />}
          onChangeText={setSearch}
          onSubmitEditing={submitSearch}
          maxLength={180}
          placeholder="O que procura hoje?"
          returnKeyType="search"
          style={styles.searchInput}
          value={search}
        />
        <View style={styles.filterButton}>
          <IconButton
            icon="options-outline"
            label="Filtros da pesquisa"
            onPress={() => openCatalog()}
          />
        </View>
      </View>

      <View style={styles.body}>
        <View>
          <AppText color="muted" variant="caption">
            BOM DIA 👋
          </AppText>
          <AppText variant="heading2">Encontre tudo no ponto certo.</AppText>
        </View>

        {managementRoute ? (
          <Card onPress={() => router.push(managementRoute)} style={styles.managementShortcut}>
            <View style={styles.managementIcon}>
              <Ionicons color={colors.textOnAccent} name="speedometer-outline" size={24} />
            </View>
            <View style={styles.managementText}>
              <AppText color="inverse" variant="bodyStrong">
                Painel de gestão
              </AppText>
              <AppText color="inverse" style={styles.managementDescription} variant="caption">
                Regresse aos indicadores e ferramentas da sua área.
              </AppText>
            </View>
            <Ionicons color={colors.textOnPrimary} name="arrow-forward" size={21} />
          </Card>
        ) : null}

        <Card padding="lg" style={styles.hero}>
          <View style={styles.heroCircleLarge} />
          <View style={styles.heroCircleSmall} />
          <Badge label="EXPLORE O CATÁLOGO" variant="promotion" />
          <AppText color="inverse" style={styles.heroTitle} variant="heading1">
            Encontre os seus próximos favoritos.
          </AppText>
          <AppText color="inverse" style={styles.heroDescription}>
            Descubra produtos e preços das lojas do Marketplace.
          </AppText>
          <Button label="Ver produtos" onPress={() => openCatalog()} variant="accent" />
          <Ionicons
            color="rgba(255,255,255,0.18)"
            name="bag-handle"
            size={145}
            style={styles.heroIcon}
          />
        </Card>

        <View style={styles.benefits}>
          {benefits.map((benefit) => (
            <View key={benefit.id} style={styles.benefit}>
              <View style={styles.benefitIcon}>
                <Ionicons color={colors.primary} name={benefit.icon} size={22} />
              </View>
              <AppText numberOfLines={2} style={styles.benefitLabel} variant="caption">
                {benefit.label}
              </AppText>
            </View>
          ))}
        </View>

        <SectionTitle
          eyebrow="DESCUBRA"
          onPress={() => router.push('/(customer)/(tabs)/categories')}
          title="Categorias"
        />
        <ScrollView
          contentContainerStyle={styles.horizontalList}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              icon="grid-outline"
              label={category.name}
              onPress={() => openCatalog({ categoryId: String(category.id) })}
            />
          ))}
        </ScrollView>

        <Card onPress={() => openCatalog({ promotion: '1' })} style={styles.coupon}>
          <View style={styles.couponIcon}>
            <Ionicons color={colors.textOnAccent} name="ticket-outline" size={24} />
          </View>
          <View style={styles.couponText}>
            <AppText color="inverse" variant="bodyStrong">
              Promoções disponíveis
            </AppText>
            <AppText color="inverse" style={styles.couponDescription} variant="caption">
              Consulte as ofertas atuais das lojas.
            </AppText>
          </View>
          <Ionicons color={colors.textOnPrimary} name="chevron-forward" size={20} />
        </Card>

        <SectionTitle eyebrow="DESCUBRA PRODUTOS" onPress={() => openCatalog()} title="Para si" />
        <QueryFeedback {...query} empty={!products.length} onRetry={query.refresh} />
        <ScrollView
          contentContainerStyle={styles.horizontalList}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {products.map((product) => (
            <ProductCard
              key={product.id}
              onPress={() =>
                router.push({
                  pathname: '/(customer)/product/[productId]',
                  params: { productId: String(product.id) },
                })
              }
              product={product}
            />
          ))}
        </ScrollView>
      </View>
    </Screen>
  );
}

/** Cabeçalho de secção com navegação para a listagem completa. */
function SectionTitle({ eyebrow, title, onPress }) {
  return (
    <View style={styles.sectionHeader}>
      <View>
        <AppText color="primary" variant="overline">
          {eyebrow}
        </AppText>
        <AppText variant="heading2">{title}</AppText>
      </View>
      <Button label="Ver tudo" onPress={onPress} variant="outline" />
    </View>
  );
}

const styles = StyleSheet.create({
  screenContent: { paddingBottom: spacing.xl },
  headerDecoration: {
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  star: {
    backgroundColor: '#35C8FF',
    borderRadius: radii.pill,
    height: 4,
    position: 'absolute',
    shadowColor: '#35C8FF',
    shadowOpacity: 0.9,
    shadowRadius: 8,
    width: 4,
  },
  starOne: { right: '22%', top: 20 },
  starTwo: { left: '8%', top: 112 },
  headerGlow: {
    backgroundColor: 'rgba(32, 199, 244, 0.09)',
    borderRadius: radii.pill,
    height: 180,
    position: 'absolute',
    right: -80,
    top: 30,
    width: 180,
  },
  header: {
    backgroundColor: colors.primaryDark,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    position: 'relative',
  },
  topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  locationRow: { alignItems: 'center', flexDirection: 'row' },
  locationText: { flex: 1, marginLeft: spacing.sm },
  locationLabel: { opacity: 0.65 },
  searchWrapper: {
    marginHorizontal: spacing.md,
    marginTop: -25,
    position: 'relative',
  },
  searchInput: { paddingLeft: spacing.sm, paddingRight: 52 },
  filterButton: { position: 'absolute', right: 3, top: 3 },
  body: { gap: spacing.lg, padding: spacing.md },
  managementShortcut: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row',
    gap: spacing.md,
  },
  managementIcon: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  managementText: { flex: 1, gap: spacing.xxs },
  managementDescription: { opacity: 0.72 },
  hero: {
    backgroundColor: colors.primaryDark,
    borderColor: '#273777',
    borderWidth: 1,
    minHeight: 300,
    overflow: 'hidden',
  },
  heroTitle: { marginTop: spacing.md, maxWidth: '75%' },
  heroDescription: {
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
    maxWidth: '68%',
    opacity: 0.78,
  },
  heroIcon: { bottom: -20, position: 'absolute', right: -14, transform: [{ rotate: '-8deg' }] },
  heroCircleLarge: {
    backgroundColor: 'rgba(53,200,255,0.10)',
    borderRadius: radii.pill,
    height: 230,
    position: 'absolute',
    right: -80,
    top: -40,
    width: 230,
  },
  heroCircleSmall: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: radii.pill,
    bottom: -50,
    height: 150,
    left: -55,
    position: 'absolute',
    width: 150,
  },
  benefits: { flexDirection: 'row', justifyContent: 'space-between' },
  benefit: { alignItems: 'center', flex: 1, gap: spacing.sm, paddingHorizontal: spacing.xs },
  benefitIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  benefitLabel: { textAlign: 'center' },
  sectionHeader: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  horizontalList: { gap: spacing.md, paddingBottom: spacing.xs, paddingRight: spacing.md },
  coupon: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row',
    gap: spacing.md,
  },
  couponIcon: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    height: 48,
    justifyContent: 'center',
    transform: [{ rotate: '-6deg' }],
    width: 48,
  },
  couponText: { flex: 1 },
  couponDescription: { opacity: 0.72 },
});
