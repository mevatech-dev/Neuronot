import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, SafeAreaView, ScrollView, Text } from 'react-native';

import { useTheme } from '@/theme';

export default function OnboardingRedoScreen() {
  const theme = useTheme();
  const { t } = useTranslation('settings');

  return (
    <>
      <Stack.Screen options={{ title: t('rows.onboarding_redo') }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.primary }}>
        <ScrollView contentContainerStyle={{ padding: theme.space[6], gap: theme.space[5] }}>
          <Text style={{ ...theme.typography.body, color: theme.colors.text.secondary }}>
            {t('onboarding_redo.body')}
          </Text>
          <Pressable
            onPress={() => router.replace('/onboarding')}
            style={{
              padding: theme.space[4],
              backgroundColor: theme.colors.accent.default,
              borderRadius: theme.radius.md,
              alignItems: 'center',
            }}
          >
            <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.accent.onAccent }}>
              {t('onboarding_redo.action')}
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
