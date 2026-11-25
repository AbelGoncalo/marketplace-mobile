import { ManagementDashboard } from '@/features/management/components/ManagementDashboard';

export function ShoppingCenterDashboardScreen() {
  const actions = [
    {
      title: 'Lojas',
      description: 'Acompanhar espaços ocupados e disponíveis.',
      icon: 'storefront-outline',
    },
    {
      title: 'Sectores',
      description: 'Organizar as áreas do centro comercial.',
      icon: 'grid-outline',
    },
    { title: 'Lojistas', description: 'Consultar os lojistas associados.', icon: 'people-outline' },
    {
      title: 'Pedidos',
      description: 'Analisar solicitações de arrendamento.',
      icon: 'document-text-outline',
    },
  ];
  return (
    <ManagementDashboard
      actions={actions}
      description="Controle a operação do seu centro comercial num único lugar."
      eyebrow="ADMINISTRAÇÃO"
      title="Painel do centro"
    />
  );
}
