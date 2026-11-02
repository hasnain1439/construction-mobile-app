import { Stack } from 'expo-router';
import { RouteGuard } from '@components/RouteGuard';
import { COLORS } from '@/lib/theme';

export default function KharchaStack() {
  return (
    <RouteGuard>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.bg } }} />
    </RouteGuard>
  );
}
