/** Hooks over the stored permissions (`src/db/access.ts`): `useCan(key)`, `usePermissions()`. */
import { readAccess } from '../db/access';
import { useQuery } from '../db/live';
import { can, canAny, seesField, type FieldKey } from '../lib/permissions';
import { useUser } from './session';

export const useAccess = () => useQuery((db) => readAccess(db), []);

/** `const canPeshgi = useCan('labor.advance.create')` — re-renders when a pull brings new permissions. */
export function useCan(key: string): boolean {
  const user = useUser();
  return can(useAccess(), user.role, key);
}

/** For screens with several checks: `const p = usePermissions(); p.can(PERM.receive)`. */
export function usePermissions() {
  const user = useUser();
  const access = useAccess();
  return {
    access,
    role: user.role,
    can: (key: string) => can(access, user.role, key),
    canAny: (...keys: string[]) => canAny(access, user.role, keys),
    sees: (field: FieldKey) => seesField(access, user.role, field),
  };
}
