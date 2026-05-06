import { Redirect } from 'expo-router';

import { useAuthStore } from '@/store/auth';

export default function Index() {
  const accessToken = useAuthStore((s) => s.accessToken);
  return <Redirect href={accessToken ? '/(tabs)/home' : '/(auth)/login'} />;
}
