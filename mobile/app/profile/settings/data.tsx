import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, SafeAreaView, ScrollView, Text } from 'react-native';

import { ExportButton } from '@/features/dataexport/ExportButton';
import { useTheme } from '@/theme';

export default function DataScreen() {
  const theme = useTheme();
  const { t } = useTranslation('data');

  return (
    <>
      <Stack.Screen options={{ title: t('title') }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.primary }}>
        <ScrollView contentContainerStyle={{ padding: theme.space[6], gap: theme.space[5] }}>
          <Text style={{ ...theme.typography.body, color: theme.colors.text.secondary }}>
            {t('export.body')}
          </Text>
          <ExportButton />

          <Pressable
            onPress={() => router.push('/profile/settings/account')}
            style={{ alignItems: 'center', paddingVertical: theme.space[5] }}
          >
            <Text style={{ ...theme.typography.body, color: theme.colors.danger.default }}>
              {t('delete_shortcut')}
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
