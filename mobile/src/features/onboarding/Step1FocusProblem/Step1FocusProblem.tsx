import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { FOCUS_PROBLEMS, type FocusProblem } from '@/features/onboarding/types';
import { useTheme } from '@/theme';

type Props = {
  value: FocusProblem | undefined;
  onChange: (next: FocusProblem) => void;
};

export function Step1FocusProblem({ value, onChange }: Props) {
  const { t } = useTranslation('onboarding');
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space[3] }}>
      <Text style={{ ...theme.typography.heading, color: theme.colors.text.primary }}>
        {t('step1.title')}
      </Text>
      {FOCUS_PROBLEMS.map((problem) => {
        const active = value === problem;
        return (
          <Pressable
            key={problem}
            onPress={() => onChange(problem)}
            style={{
              padding: theme.space[4],
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: active ? theme.colors.border.focus : theme.colors.border.subtle,
              backgroundColor: active ? theme.colors.surface.raised : theme.colors.surface.elevated,
            }}
          >
            <Text style={{ ...theme.typography.body, color: theme.colors.text.primary }}>
              {t(`step1.options.${problem}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
