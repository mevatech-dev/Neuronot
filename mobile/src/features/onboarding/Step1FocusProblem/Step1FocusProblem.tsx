import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
} from 'react-native-reanimated';

import { FOCUS_PROBLEMS, type FocusProblem } from '@/features/onboarding/types';
import { useTheme } from '@/theme';

type Props = {
  value: FocusProblem[] | undefined;
  onChange: (next: FocusProblem[]) => void;
};

export function Step1FocusProblem({ value, onChange }: Props) {
  const { t } = useTranslation('onboarding');
  const theme = useTheme();
  const selected = value ?? [];

  const toggle = (problem: FocusProblem) => {
    onChange(
      selected.includes(problem)
        ? selected.filter((p) => p !== problem)
        : [...selected, problem],
    );
  };

  return (
    <View style={{ gap: theme.space[5] }}>
      {/* Speech bubble — Neuro asking the question */}
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
          {t('step1.title')}
        </Text>
        <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>
          {t('step1.subtitle')}
        </Text>
      </Animated.View>

      {/* Answer chips — staggered fade-up */}
      <View style={{ gap: theme.space[2] }}>
        {FOCUS_PROBLEMS.map((problem, idx) => {
          const active = selected.includes(problem);
          return (
            <Animated.View
              key={problem}
              entering={FadeInDown.delay(120 + idx * 60)
                .duration(380)
                .easing(Easing.out(Easing.cubic))}
            >
              <Pressable
                onPress={() => toggle(problem)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.space[3],
                  paddingHorizontal: theme.space[4],
                  paddingVertical: theme.space[3],
                  borderRadius: theme.radius.full,
                  borderWidth: active ? 2 : 1.5,
                  borderColor: active ? theme.colors.accent.default : theme.colors.border.strong,
                  backgroundColor: active ? theme.colors.accent.muted : theme.colors.surface.elevated,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: active ? 4 : 1 },
                  shadowOpacity: active ? 0.1 : 0.03,
                  shadowRadius: active ? 10 : 4,
                  elevation: active ? 3 : 1,
                }}
              >
                <Text
                  style={{
                    ...theme.typography.bodyMedium,
                    color: theme.colors.text.primary,
                    flex: 1,
                  }}
                >
                  {t(`step1.options.${problem}`)}
                </Text>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 9999,
                    borderWidth: active ? 0 : 1.5,
                    borderColor: theme.colors.border.strong,
                    backgroundColor: active ? theme.colors.accent.default : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {active ? (
                    <Text
                      style={{
                        color: theme.colors.accent.onAccent,
                        fontSize: 16,
                        fontWeight: '700',
                        lineHeight: 18,
                      }}
                    >
                      ✓
                    </Text>
                  ) : (
                    <Text style={{ color: theme.colors.text.muted, fontSize: 16, fontWeight: '600' }}>
                      +
                    </Text>
                  )}
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}
