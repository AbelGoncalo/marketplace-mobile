import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { OrderAccess } from '@/features/orders/components/OrderAccess';
import { getFavorites, setFavorite } from '@/features/favorites/services/favoritesApi';
import { ProductImage } from '@/features/catalog/components/ProductImage';
import {
  ReturnLayout,
  ReturnPanel,
  ReturnFeedback,
  ReturnPagination,
  useReturnRefresh,
} from '@/features/returns/components/ReturnLayout';
import { useApiQuery } from '@/shared/hooks/useApiQuery';
import { AppText, Button } from '@/shared/ui';

/** Protege a lista e desmonta os dados ao mudar de conta. */
export function FavoritesScreen() {
  return (
    <OrderAccess
      title="Favoritos"
      description="Entre para guardar e consultar produtos favoritos."
      returnTo="favorites"
    >
      {(session) => <Favorites key={session.token} token={session.token} />}
    </OrderAccess>
  );
}
/** Mantém produtos inativos visíveis para permitir remover a associação sem apagar o produto. */
function Favorites({ token }) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const loader = useCallback(() => getFavorites(token, page), [token, page]);
  const query = useApiQuery(loader);
  useReturnRefresh(query.refresh);
  async function remove(product) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await setFavorite(token, product, false);
      setPage(1);
    } catch (failure) {
      setError(failure.message);
    } finally {
      lock.current = false;
      setBusy(false);
      query.refresh();
    }
  }
  return (
    <ReturnLayout
      title="Favoritos"
      subtitle="Os produtos que guardou na sua conta."
      backTo="/(customer)/(tabs)/profile"
      onRefresh={query.refresh}
      busy={busy || query.isLoading}
    >
      {error ? (
        <AppText color="danger" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
      <ReturnFeedback
        {...query}
        loadingText="A consultar favoritos..."
        onRetry={query.refresh}
        empty={Boolean(query.data && !query.data.data.length)}
        emptyText="Ainda não guardou produtos. Use o coração no detalhe de um produto."
      />
      {(query.data?.data || []).map((item) => (
        <ReturnPanel key={item.product_id}>
          <ProductImage
            path={item.image}
            label={item.name}
            style={{ width: '100%', height: 150 }}
          />
          <AppText variant="heading3">{item.name}</AppText>
          {!item.product_active ? (
            <AppText color="muted">Produto indisponível</AppText>
          ) : (
            <Button
              label="Ver produto"
              fullWidth
              variant="outline"
              disabled={busy}
              onPress={() =>
                router.push({
                  pathname: '/(customer)/product/[productId]',
                  params: { productId: item.product_id },
                })
              }
            />
          )}
          <Button
            label="Remover dos favoritos"
            fullWidth
            variant="outline"
            disabled={busy}
            onPress={() => remove(item.product_id)}
          />
        </ReturnPanel>
      ))}
      {query.data && !busy ? (
        <ReturnPagination page={page} data={query.data} onPage={setPage} />
      ) : null}
    </ReturnLayout>
  );
}
