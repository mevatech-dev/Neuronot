import { useTranslation } from 'react-i18next';
import { Pressable, Switch, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';

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
    <View style={{ gap: theme.space[5] }}>
      <Animated.View
        entering={FadeInDown.duration(420).easing(Easing.out(Easing.cubic))}
        style={{
          alignSelf: 'stretch',
          backgroundColor: theme.colors.surface.elevated,
          borderRadius: theme.radius.xl,
          borderTopLeftRadius: theme.radius.sm,
          paddingHorizontal: theme.space[5],
          paddingVertical: theme.space[4],
          gap: theme.space[2],
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.06,
          shadowRadius: 14,
          elevation: 3,
        }}
      >
        <Text style={{ ...theme.typography.title, color: theme.colors.text.primary }}>
          {t('step5.title')}
        </Text>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(140).duration(380).easing(Easing.out(Easing.cubic))}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: theme.space[4],
          borderRadius: theme.radius.lg,
          backgroundColor: theme.colors.surface.elevated,
          borderWidth: 1,
          borderColor: theme.colors.border.subtle,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 8,
          elevation: 1,
        }}
      >
        <Text style={{ ...theme.typography.body, color: theme.colors.text.primary, flex: 1 }}>
          {t('step5.reminder_label')}
        </Text>
        <Switch value={!!enabled} onValueChange={onEnabledChange} />
      </Animated.View>

      {enabled && (
        <View style={{ gap: theme.space[3] }}>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted }}>
            {t('step5.hour_label')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
            {HOUR_OPTIONS.map((h, idx) => {
              const active = hour === h;
              return (
                <Animated.View
                  key={h}
                  entering={FadeInDown.delay(60 + idx * 50)
                    .duration(320)
                    .easing(Easing.out(Easing.cubic))}
                >
                  <Pressable
                    onPress={() => onHourChange(h)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    style={{
                      paddingHorizontal: theme.space[4],
                      paddingVertical: theme.space[3],
                      borderRadius: theme.radius.full,
                      borderWidth: active ? 2 : 1.5,
                      borderColor: active
                        ? theme.colors.accent.default
                        : theme.colors.border.strong,
                      backgroundColor: active
                        ? theme.colors.accent.muted
                        : theme.colors.surface.elevated,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: active ? 4 : 1 },
                      shadowOpacity: active ? 0.1 : 0.03,
                      shadowRadius: active ? 10 : 4,
                      elevation: active ? 3 : 1,
                    }}
                  >
                    <Text
                      style={{ ...theme.typography.bodyMedium, color: theme.colors.text.primary }}
                    >
                      {`${h.toString().padStart(2, '0')}:00`}
                    </Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}
