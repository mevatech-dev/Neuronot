import { useQuery } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';

import { profileQuery } from '@/features/profile/queries';
import { LanguagePicker } from '@/features/settings/LanguagePicker';
import { LogoutButton } from '@/features/settings/LogoutButton';
import { ReminderRow } from '@/features/settings/ReminderRow';
import { SettingsLinkRow } from '@/features/settings/SettingsLinkRow';
import { ThemePicker } from '@/features/settings/ThemePicker';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme';

export default function SettingsScreen() {
  const theme = useTheme();
  const { t } = useTranslation('settings');
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const profile = useQuery(profileQuery(userId));

  const sectionTitle = (txt: string) => (
    <Text
      style={{
        ...theme.typography.caption,
        color: theme.colors.text.muted,
        marginTop: theme.space[6],
        marginBottom: theme.space[3],
      }}
    >
      {txt}
    </Text>
  );

  return (
    <>
      <Stack.Screen options={{ title: t('title') }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.primary }}>
        <ScrollView contentContainerStyle={{ padding: theme.space[6] }}>
          <ThemePicker />
          <View style={{ height: theme.space[5] }} />
          <LanguagePicker />
          <View style={{ height: theme.space[5] }} />
          <ReminderRow
            enabled={profile.data?.reminder_enabled ?? false}
            hour={profile.data?.reminder_hour ?? null}
          />

          {sectionTitle(t('section.account_data'))}
          <View style={{ gap: theme.space[2] }}>
            <SettingsLinkRow
              icon="🔐"
              label={t('rows.account')}
              onPress={() => router.push('/profile/settings/account')}
            />
            <SettingsLinkRow
              icon="📥"
              label={t('rows.data')}
              onPress={() => router.push('/profile/settings/data')}
            />
            <SettingsLinkRow
              icon="✅"
              label={t('rows.consents')}
              onPress={() => router.push('/profile/settings/consents')}
            />
          </View>

          {sectionTitle(t('section.help'))}
          <View style={{ gap: theme.space[2] }}>
            <SettingsLinkRow
              icon="🆘"
              label={t('rows.crisis')}
              onPress={() => router.push('/profile/settings/crisis')}
            />
            <SettingsLinkRow
              icon="✉️"
              label={t('rows.help')}
              onPress={() => router.push('/profile/settings/help')}
            />
          </View>

          {sectionTitle(t('section.about'))}
          <View style={{ gap: theme.space[2] }}>
            <SettingsLinkRow
              icon="ℹ️"
              label={t('rows.about')}
              onPress={() => router.push('/profile/settings/about')}
            />
            <SettingsLinkRow
              icon="🔄"
              label={t('rows.onboarding_redo')}
              onPress={() => router.push('/profile/settings/onboarding-redo')}
            />
          </View>

          <View style={{ height: theme.space[8] }} />
          <LogoutButton />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
