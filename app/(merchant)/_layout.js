import { RoleProtectedLayout } from '@/features/auth/components/RoleProtectedLayout';

export default function MerchantLayout() {
  return <RoleProtectedLayout role="store-owner" />;
}
