import { AppText, Button, Card, LoadingState } from '@/shared/ui';

/** Uniformiza carregamento, falha com repetição e ausência de resultados do catálogo. */
export function QueryFeedback({
  isLoading,
  error,
  empty,
  onRetry,
  emptyMessage = 'Não foram encontrados produtos.',
}) {
  if (isLoading) return <LoadingState message="A carregar catálogo..." />;
  if (error)
    return (
      <Card>
        <AppText color="danger">{error}</AppText>
        <Button label="Tentar novamente" onPress={onRetry} />
      </Card>
    );
  if (empty)
    return (
      <Card>
        <AppText color="muted">{emptyMessage}</AppText>
      </Card>
    );
  return null;
}
