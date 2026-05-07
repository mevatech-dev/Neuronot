import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';

import { NeuroMascot } from '@/components/brand/NeuroMascot';
import { ProfileEditSheet } from '@/features/profile/ProfileEditSheet';
import { ProfileSummaryCard } from '@/features/profile/ProfileSummaryCard';
import { profileQuery } from '@/features/profile/queries';
import { SettingsLinkRow } from '@/features/settings/SettingsLinkRow';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme';

export default function ProfileScreen() {
  const theme = useTheme();
  const { t } = useTranslation(['common', 'settings']);
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? null;
  const profile = useQuery(profileQuery(userId));
  const [editVisible, setEditVisible] = useState(false);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.primary }}>
      <ScrollView contentContainerStyle={{ padding: theme.space[6], gap: theme.space[5] }}>
        <View style={{ alignItems: 'center', marginBottom: theme.space[3] }}>
          <NeuroMascot mood="calm" size={88} />
        </View>

        <Text style={{ ...theme.typography.title, color: theme.colors.text.primary }}>
          {t('common:tabs.profile')}
        </Text>

        <ProfileSummaryCard
          loading={profile.isLoading}
          email={user?.email ?? ''}
          memberSinceISO={null}
          focusProblem={profile.data?.focus_problem ?? null}
          intensity={profile.data?.intensity_level ?? null}
          sleepHours={profile.data?.avg_sleep_hours ?? null}
          caffeine={profile.data?.caffeine_daily ?? null}
          reminderHour={profile.data?.reminder_hour ?? null}
          reminderEnabled={profile.data?.reminder_enabled ?? false}
        />

        <SettingsLinkRow
          icon="✏️"
          label={t('settings:profile.edit_action')}
          onPress={() => setEditVisible(true)}
        />

        <View style={{ height: 1, backgroundColor: theme.colors.border.subtle, marginVertical: theme.space[3] }} />

        <SettingsLinkRow
          icon="⚙️"
          label={t('settings:settings_entry')}
          onPress={() => router.push('/profile/settings')}
        />
      </ScrollView>

      <ProfileEditSheet visible={editVisible} onClose={() => setEditVisible(false)} />
    </SafeAreaView>
  );
}
