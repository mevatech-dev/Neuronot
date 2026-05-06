import { useTranslation } from 'react-i18next';
import { SafeAreaView, Text, View } from 'react-native';

import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme';

export default function HomeScreen() {
  const { t } = useTranslation('common');
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.primary }}>
      <View style={{ flex: 1, padding: theme.space[6] }}>
        <Text style={{ ...theme.typography.title, color: theme.colors.text.primary }}>
          {t('app.name')}
        </Text>
        <Text style={{ ...theme.typography.body, color: theme.colors.text.secondary, marginTop: theme.space[2] }}>
          {user?.email ?? ''}
        </Text>
      </View>
    </SafeAreaView>
  );
}
