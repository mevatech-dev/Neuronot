import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, ScrollView, Text } from 'react-native';

import { ConsentsList } from '@/features/consents/ConsentsList';
import { useTheme } from '@/theme';

export default function ConsentsScreen() {
  const theme = useTheme();
  const { t } = useTranslation('consents');

  return (
    <>
      <Stack.Screen options={{ title: t('title') }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.primary }}>
        <ScrollView contentContainerStyle={{ padding: theme.space[6], gap: theme.space[5] }}>
          <Text style={{ ...theme.typography.body, color: theme.colors.text.secondary }}>
            {t('intro')}
          </Text>
          <ConsentsList />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
