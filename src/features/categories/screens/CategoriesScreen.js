import { useRouter } from 'expo-router';
import { FlatList, StyleSheet } from 'react-native';

import { QueryFeedback } from '@/features/catalog/components/QueryFeedback';
import { getCatalogCategories } from '@/features/catalog/services/catalogApi';
import { useApiQuery } from '@/shared/hooks/useApiQuery';
import { AppText, Button, Card, Screen } from '@/shared/ui';
import { spacing } from '@/theme';

/** Carrega categorias públicas e abre o catálogo filtrado pela categoria escolhida. */
export function CategoriesScreen() {
  const router = useRouter();
  const query = useApiQuery(getCatalogCategories);
  return (
    <Screen padded={false}>
      <FlatList
        data={query.data || []}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <AppText variant="heading1">Categorias</AppText>
            <Button
              label="Ver todos os produtos"
              onPress={() => router.push('/(customer)/catalog')}
            />
          </>
        }
        ListEmptyComponent={
          <QueryFeedback
            {...query}
            empty
            emptyMessage="Ainda não existem categorias disponíveis."
            onRetry={query.refresh}
          />
        }
        renderItem={({ item }) => (
          <Card
            onPress={() =>
              router.push({
                pathname: '/(customer)/catalog',
                params: { categoryId: String(item.id) },
              })
            }
          >
            <AppText variant="bodyStrong">{item.name}</AppText>
          </Card>
        )}
      />
    </Screen>
  );
}

// O espaçamento aplica-se também às mensagens de carregamento e ausência de dados.
const styles = StyleSheet.create({ content: { padding: spacing.md, gap: spacing.md } });
