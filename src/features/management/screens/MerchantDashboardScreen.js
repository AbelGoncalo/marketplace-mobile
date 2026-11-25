import { useRouter } from 'expo-router';
import { ManagementDashboard } from '@/features/management/components/ManagementDashboard';

/** Liga o percurso de encomendas do MVP ao painel existente do lojista. */
export function MerchantDashboardScreen() {
  const router = useRouter();
  const actions = [
    {
      title: 'Produtos',
      description: 'Gerir catálogo, preços e disponibilidade.',
      icon: 'cube-outline',
    },
    {
      title: 'Minhas lojas',
      description: 'Consultar lojas associadas ao seu negócio.',
      icon: 'storefront-outline',
    },
    {
      title: 'Arrendamento',
      description: 'Procurar espaços e acompanhar pedidos.',
      icon: 'key-outline',
    },
    {
      title: 'Encomendas',
      onPress: () => router.push('/(merchant)/merchant/orders'),
      description: 'Acompanhar vendas e preparação de pedidos.',
      icon: 'receipt-outline',
    },
  ];
  return (
    <ManagementDashboard
      actions={actions}
      description="Produtos, lojas e vendas organizados para o seu negócio."
      eyebrow="ÁREA DO LOJISTA"
      title="O seu negócio"
    />
  );
}
