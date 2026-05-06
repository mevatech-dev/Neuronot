import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { NeuroMascot } from '@/components/brand/NeuroMascot';
import { useFadeIn } from '@/hooks/useFadeIn';
import { useHapticPress } from '@/hooks/useHapticPress';
import { useTheme } from '@/theme';

type Props = {
  onStart: () => void;
};

export function Welcome({ onStart }: Props) {
  const theme = useTheme();
  const { t } = useTranslation('onboarding');
  const fade = useFadeIn();
  const press = useHapticPress();

  return (
    <Animated.View style={[{ flex: 1, padding: theme.space[6], justifyContent: 'center', gap: theme.space[6] }, fade]}>
      <View style={{ alignItems: 'center' }}>
        <NeuroMascot mood="calm" size={156} />
      </View>
      <View style={{ gap: theme.space[3] }}>
        <Text style={{ ...theme.typography.display, color: theme.colors.text.primary, textAlign: 'center' }}>
          {t('welcome.title')}
        </Text>
        <Text style={{ ...theme.typography.body, color: theme.colors.text.secondary, textAlign: 'center' }}>
          {t('welcome.body')}
        </Text>
      </View>
      <Animated.View style={press.style}>
        <Pressable
          onPress={onStart}
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          style={{
            backgroundColor: theme.colors.accent.default,
            paddingVertical: theme.space[4],
            borderRadius: theme.radius.md,
            alignItems: 'center',
          }}
        >
          <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.accent.onAccent }}>
            {t('welcome.cta')}
          </Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}
