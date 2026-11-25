import { RoleProtectedLayout } from '@/features/auth/components/RoleProtectedLayout';

export default function SuperAdminLayout() {
  return <RoleProtectedLayout role="super-admin" />;
}
