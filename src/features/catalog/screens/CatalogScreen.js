import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { QueryFeedback } from '@/features/catalog/components/QueryFeedback';
import { getCatalogCategories, getCatalogProducts } from '@/features/catalog/services/catalogApi';
import { routeValue } from '@/features/catalog/utils/productPresentation';
import { ProductCard } from '@/features/home/components/ProductCard';
import { useApiQuery } from '@/shared/hooks/useApiQuery';
import { AppText, Button, Input, Screen, Select } from '@/shared/ui';
import { spacing } from '@/theme';

// As opções correspondem exclusivamente às ordenações aceites pelo catálogo público.
const sortOptions = [
  { label: 'Mais recentes', value: 'newest' },
  { label: 'Menor preço', value: 'price_asc' },
  { label: 'Maior preço', value: 'price_desc' },
  { label: 'Mais vendidos', value: 'best_sellers' },
  { label: 'Maiores descontos', value: 'discount' },
  { label: 'Nome', value: 'name' },
];

/** Reinicia os filtros locais quando uma nova navegação fornece parâmetros diferentes. */
export function CatalogScreen() {
  const params = useLocalSearchParams();
  const initial = {
    search: routeValue(params.search).slice(0, 180),
    categoryId: routeValue(params.categoryId),
    promotion: routeValue(params.promotion) === '1',
  };
  return <CatalogResults key={JSON.stringify(initial)} initial={initial} />;
}

/** Lista páginas do servidor e reinicia a paginação ao alterar pesquisa ou filtros. */
function CatalogResults({ initial }) {
  const router = useRouter();
  const list = useRef(null);
  const [search, setSearch] = useState(initial.search);
  const [filters, setFilters] = useState({ ...initial, sort: 'newest', page: 1 });
  const loader = useCallback(() => getCatalogProducts(filters), [filters]);
  const query = useApiQuery(loader);
  const categories = useApiQuery(getCatalogCategories);
  const items = query.data?.data || [];
  const lastPage = Number(query.data?.last_page) || 1;

  /** Aplica alterações numa única atualização para nunca pedir a página antiga do novo filtro. */
  function updateFilters(changes) {
    setFilters((current) => ({ ...current, ...changes, page: 1 }));
    list.current?.scrollToOffset({ offset: 0, animated: false });
  }

  /** Substitui a página visível sem acumular produtos nem duplicar resultados. */
  function changePage(page) {
    setFilters((current) => ({ ...current, page }));
    list.current?.scrollToOffset({ offset: 0, animated: false });
  }

  return (
    <Screen padded={false}>
      <FlatList
        ref={list}
        data={query.isLoading || query.error ? [] : items}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        contentContainerStyle={styles.content}
        columnWrapperStyle={styles.row}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <Button
              label="Início"
              variant="outline"
              onPress={() => router.replace('/(customer)/(tabs)')}
            />
            <AppText variant="heading1">Catálogo</AppText>
            <Input
              accessibilityLabel="Pesquisar produtos"
              maxLength={180}
              placeholder="Pesquisar produtos"
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
              onSubmitEditing={() => updateFilters({ search: search.trim() })}
            />
            <Button label="Pesquisar" onPress={() => updateFilters({ search: search.trim() })} />
            <Select
              label="Categoria"
              value={filters.categoryId}
              placeholder="Todas as categorias"
              options={[
                { label: 'Todas as categorias', value: '' },
                ...(categories.data || []).map((item) => ({
                  label: item.name,
                  value: String(item.id),
                })),
              ]}
              onChange={(categoryId) => updateFilters({ categoryId })}
            />
            {categories.error ? (
              <View>
                <AppText color="danger">Não foi possível carregar as categorias.</AppText>
                <Button label="Repetir categorias" variant="outline" onPress={categories.refresh} />
              </View>
            ) : null}
            <Select
              label="Ordenar por"
              value={filters.sort}
              options={sortOptions}
              onChange={(sort) => updateFilters({ sort })}
            />
            <Button
              label={filters.promotion ? 'Promoções: ativas' : 'Mostrar promoções'}
              variant={filters.promotion ? 'primary' : 'outline'}
              onPress={() => updateFilters({ promotion: !filters.promotion })}
            />
            {!query.isLoading && !query.error ? (
              <AppText color="muted">{query.data?.total || 0} produtos encontrados</AppText>
            ) : null}
          </View>
        }
        ListEmptyComponent={<QueryFeedback {...query} empty onRetry={query.refresh} />}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            style={styles.product}
            onPress={() =>
              router.push({
                pathname: '/(customer)/product/[productId]',
                params: { productId: String(item.id) },
              })
            }
          />
        )}
        ListFooterComponent={
          !query.isLoading && !query.error && lastPage > 1 ? (
            <View style={styles.pagination}>
              <AppText>
                Página {filters.page} de {lastPage}
              </AppText>
              <View style={styles.pageButtons}>
                <Button
                  label="Anterior"
                  variant="outline"
                  disabled={filters.page <= 1}
                  onPress={() => changePage(filters.page - 1)}
                />
                <Button
                  label="Seguinte"
                  disabled={filters.page >= lastPage}
                  onPress={() => changePage(filters.page + 1)}
                />
              </View>
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

// A FlatList mantém uma grelha virtualizada e espaçamento consistente em ecrãs pequenos.
const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  header: { gap: spacing.md, marginBottom: spacing.lg },
  row: { gap: spacing.sm, marginBottom: spacing.sm },
  product: { flex: 1, width: 0, maxWidth: '50%' },
  pagination: { gap: spacing.md, paddingVertical: spacing.lg },
  pageButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
