import { RoleProtectedLayout } from '@/features/auth/components/RoleProtectedLayout';

export default function ShoppingCenterAdminLayout() {
  return <RoleProtectedLayout role="shopping-center-admin" />;
}
