import { useTranslation } from 'react-i18next';
import { Pressable, Switch, Text, View } from 'react-native';

import { useLocalReminder } from '@/hooks/useLocalReminder';
import { usePatchProfile } from '@/features/profile/mutations';
import { useTheme } from '@/theme';

type Props = {
  enabled: boolean;
  hour: number | null;
};

const HOURS = [7, 9, 12, 15, 18, 21] as const;

export function ReminderRow({ enabled, hour }: Props) {
  const { t } = useTranslation('settings');
  const theme = useTheme();
  const patchProfile = usePatchProfile();
  const { requestPermissionAndSchedule, cancel } = useLocalReminder();

  const toggleReminder = async (nextEnabled: boolean) => {
    if (nextEnabled) {
      const nextHour = hour ?? 9;
      const ok = await requestPermissionAndSchedule(nextHour);
      if (!ok) return;

      patchProfile.mutate({ reminder_enabled: true, reminder_hour: nextHour });
      return;
    }

    await cancel();
    patchProfile.mutate({ reminder_enabled: false });
  };

  const pickHour = async (nextHour: number) => {
    if (enabled) {
      const ok = await requestPermissionAndSchedule(nextHour);
      if (!ok) return;
    }

    patchProfile.mutate({ reminder_hour: nextHour, reminder_enabled: enabled });
  };

  return (
    <View
      style={{
        padding: theme.space[4],
        backgroundColor: theme.colors.surface.elevated,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border.subtle,
        gap: theme.space[3],
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}>
        <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.text.primary, flex: 1 }}>
          {t('reminder.title')}
        </Text>
        <Switch
          value={enabled}
          onValueChange={(value) => {
            void toggleReminder(value);
          }}
        />
      </View>

      {enabled && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
          {HOURS.map((h) => {
            const active = hour === h;

            return (
              <Pressable
                key={h}
                onPress={() => {
                  void pickHour(h);
                }}
                style={{
                  paddingHorizontal: theme.space[3],
                  paddingVertical: theme.space[2],
                  borderRadius: theme.radius.md,
                  borderWidth: 1,
                  borderColor: active ? theme.colors.border.focus : theme.colors.border.subtle,
                  backgroundColor: active ? theme.colors.surface.raised : theme.colors.surface.elevated,
                }}
              >
                <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.text.primary }}>
                  {`${h.toString().padStart(2, '0')}:00`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
