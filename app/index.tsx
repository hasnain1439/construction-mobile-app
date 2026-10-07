import { Redirect } from 'expo-router';
import { useSession } from '@/features/session';

export default function Index() {
  const { status } = useSession();
  if (status === 'update') return <Redirect href="/update" />;
  if (status === 'signedOut') return <Redirect href="/login" />;
  if (status === 'firstSync') return <Redirect href="/first-sync" />;
  return <Redirect href="/aaj" />;
}
