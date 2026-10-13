import { usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { EmptyState } from './EmptyState';
import { Header } from './Header';
import { Screen } from './Screen';
import { useAccess } from '@/features/access';
import { useUser } from '@/features/session';
import { useT } from '@/i18n';
import { routeAllowed } from '@/lib/permissions';

/** Wraps a stack: a screen the person has no permission for shows "Aap ko is ki ijazat nahi". */
export function RouteGuard({ children }: { children: ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const user = useUser();
  const access = useAccess();
  if (routeAllowed(access, user.role, pathname)) return <>{children}</>;
  return (
    <Screen header={<Header back title="" />} refresh={false}>
      <EmptyState icon="🔒" title={t('err.PERMISSION_DENIED')} />
    </Screen>
  );
}
