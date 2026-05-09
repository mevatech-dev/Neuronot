import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';

import { useTheme } from '@/theme';

type Props = {
  value: boolean | undefined;
  onChange: (next: boolean) => void;
};

const OPTIONS: { val: boolean; key: 'yes' | 'no' }[] = [
  { val: true, key: 'yes' },
  { val: false, key: 'no' },
];

export function Step4Caffeine({ value, onChange }: Props) {
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
          {t('step4.title')}
        </Text>
        <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>
          {t('step4.hint')}
        </Text>
      </Animated.View>

      <View style={{ flexDirection: 'row', gap: theme.space[2] }}>
        {OPTIONS.map((opt, idx) => {
          const active = value === opt.val;
          return (
            <Animated.View
              key={opt.key}
              style={{ flex: 1 }}
              entering={FadeInDown.delay(120 + idx * 60)
                .duration(380)
                .easing(Easing.out(Easing.cubic))}
            >
              <Pressable
                onPress={() => onChange(opt.val)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={{
                  alignItems: 'center',
                  paddingVertical: theme.space[4],
                  borderRadius: theme.radius.full,
                  borderWidth: active ? 2 : 1.5,
                  borderColor: active ? theme.colors.accent.default : theme.colors.border.strong,
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
                <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.text.primary }}>
                  {t(`step4.${opt.key}`)}
                </Text>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}
