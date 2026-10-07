import { useEffect, useState } from 'react';
import { getStatus, subscribe, type SyncStatus } from './engine';

export function useSyncStatus(): SyncStatus {
  const [s, setS] = useState(getStatus());
  useEffect(() => subscribe(setS), []);
  return s;
}
