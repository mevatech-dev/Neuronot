import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, ScrollView } from 'react-native';

import { VersionRow } from '@/features/about/VersionRow';
import { useTheme } from '@/theme';

export default function AboutScreen() {
  const theme = useTheme();
  const { t } = useTranslation('about');

  return (
    <>
      <Stack.Screen options={{ title: t('title') }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.primary }}>
        <ScrollView contentContainerStyle={{ padding: theme.space[6], gap: theme.space[4] }}>
          <VersionRow />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
