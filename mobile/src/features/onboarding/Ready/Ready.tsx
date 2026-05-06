import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { NeuroMascot } from '@/components/brand/NeuroMascot';
import { LoadingDots } from '@/components/feedback/LoadingDots';
import { useFadeIn } from '@/hooks/useFadeIn';
import { useHapticPress } from '@/hooks/useHapticPress';
import { useTheme } from '@/theme';

type Props = {
  onFinish: () => void;
  submitting: boolean;
};

export function Ready({ onFinish, submitting }: Props) {
  const theme = useTheme();
  const { t } = useTranslation('onboarding');
  const fade = useFadeIn();
  const press = useHapticPress();

  return (
    <Animated.View style={[{ flex: 1, padding: theme.space[6], justifyContent: 'center', gap: theme.space[6] }, fade]}>
      <View style={{ alignItems: 'center' }}>
        <NeuroMascot mood="happy" size={156} />
      </View>
      <View style={{ gap: theme.space[3] }}>
        <Text style={{ ...theme.typography.display, color: theme.colors.text.primary, textAlign: 'center' }}>
          {t('ready.title')}
        </Text>
        <Text style={{ ...theme.typography.body, color: theme.colors.text.secondary, textAlign: 'center' }}>
          {t('ready.body')}
        </Text>
      </View>
      <Animated.View style={press.style}>
        <Pressable
          onPress={onFinish}
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          disabled={submitting}
          style={{
            backgroundColor: submitting ? theme.colors.accent.muted : theme.colors.accent.default,
            paddingVertical: theme.space[4],
            borderRadius: theme.radius.md,
            alignItems: 'center',
          }}
        >
          {submitting ? (
            <LoadingDots color={theme.colors.accent.onAccent} />
          ) : (
            <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.accent.onAccent }}>
              {t('ready.cta')}
            </Text>
          )}
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}
