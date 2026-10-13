import { Stack } from 'expo-router';
import { RouteGuard } from '@components/RouteGuard';

export default function KharchaStack() {
  return (
    <RouteGuard>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F5F6FA' } }} />
    </RouteGuard>
  );
}
