import { useTranslation } from 'react-i18next';
import { Pressable, Switch, Text, View } from 'react-native';

import { useTheme } from '@/theme';

type Props = {
  enabled: boolean | undefined;
  hour: number | undefined;
  onEnabledChange: (next: boolean) => void;
  onHourChange: (next: number) => void;
};

const HOUR_OPTIONS = [7, 9, 12, 15, 18, 21];

export function Step5Reminder({ enabled, hour, onEnabledChange, onHourChange }: Props) {
  const { t } = useTranslation('onboarding');
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space[3] }}>
      <Text style={{ ...theme.typography.heading, color: theme.colors.text.primary }}>
        {t('step5.title')}
      </Text>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: theme.space[4],
          borderRadius: theme.radius.md,
          backgroundColor: theme.colors.surface.elevated,
          borderWidth: 1,
          borderColor: theme.colors.border.subtle,
        }}
      >
        <Text style={{ ...theme.typography.body, color: theme.colors.text.primary, flex: 1 }}>
          {t('step5.reminder_label')}
        </Text>
        <Switch value={!!enabled} onValueChange={onEnabledChange} />
      </View>

      {enabled && (
        <View style={{ gap: theme.space[2] }}>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted }}>
            {t('step5.hour_label')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
            {HOUR_OPTIONS.map((h) => {
              const active = hour === h;
              return (
                <Pressable
                  key={h}
                  onPress={() => onHourChange(h)}
                  style={{
                    paddingHorizontal: theme.space[4],
                    paddingVertical: theme.space[3],
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
        </View>
      )}
    </View>
  );
}
