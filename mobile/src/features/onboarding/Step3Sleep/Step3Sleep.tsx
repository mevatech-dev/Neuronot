import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TextInput, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';

import { useTheme } from '@/theme';

type Props = {
  value: number | undefined;
  onChange: (next: number | undefined) => void;
};

export function Step3Sleep({ value, onChange }: Props) {
  const { t } = useTranslation('onboarding');
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

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
          {t('step3.title')}
        </Text>
        <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>
          {t('step3.sleep_hint')}
        </Text>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(140).duration(380).easing(Easing.out(Easing.cubic))}
        style={{ gap: theme.space[2] }}
      >
        <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted }}>
          {t('step3.sleep_label')}
        </Text>
        <TextInput
          keyboardType="decimal-pad"
          value={value?.toString() ?? ''}
          onChangeText={(txt) => {
            const n = Number(txt.replace(',', '.'));
            onChange(Number.isFinite(n) ? n : undefined);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            ...theme.typography.title,
            backgroundColor: theme.colors.surface.elevated,
            color: theme.colors.text.primary,
            borderColor: focused ? theme.colors.accent.default : theme.colors.border.subtle,
            borderWidth: focused ? 2 : 1,
            borderRadius: theme.radius.lg,
            paddingHorizontal: theme.space[5],
            paddingVertical: theme.space[4],
            textAlign: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: focused ? 4 : 1 },
            shadowOpacity: focused ? 0.1 : 0.03,
            shadowRadius: focused ? 10 : 4,
            elevation: focused ? 3 : 1,
          }}
          placeholderTextColor={theme.colors.text.muted}
        />
      </Animated.View>
    </View>
  );
}
