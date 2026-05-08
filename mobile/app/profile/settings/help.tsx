import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, ScrollView, Text } from 'react-native';

import { SupportMailtoButton } from '@/features/help/SupportMailtoButton';
import { useTheme } from '@/theme';

export default function HelpScreen() {
  const theme = useTheme();
  const { t } = useTranslation('help');

  return (
    <>
      <Stack.Screen options={{ title: t('title') }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.primary }}>
        <ScrollView contentContainerStyle={{ padding: theme.space[6], gap: theme.space[5] }}>
          <Text style={{ ...theme.typography.body, color: theme.colors.text.secondary }}>
            {t('intro')}
          </Text>
          <SupportMailtoButton />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
