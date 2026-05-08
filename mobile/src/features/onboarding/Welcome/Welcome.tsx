import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { NeuroMascot } from '@/components/brand/NeuroMascot';
import { useFadeIn } from '@/hooks/useFadeIn';
import { useHapticPress } from '@/hooks/useHapticPress';
import { useTheme } from '@/theme';

type Props = {
  onStart: () => void;
};

const ORB_DURATION_A = 9000;
const ORB_DURATION_B = 11000;
const ORB_DURATION_C = 14000;

function useOrbAnim(duration: number, dx: number, dy: number, scaleTo: number) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [duration, t]);
  return useAnimatedStyle(() => ({
    transform: [
      { translateX: t.value * dx },
      { translateY: t.value * dy },
      { scale: 1 + t.value * (scaleTo - 1) },
    ],
  }));
}

export function Welcome({ onStart }: Props) {
  const theme = useTheme();
  const { t } = useTranslation('onboarding');
  const fade = useFadeIn();
  const press = useHapticPress();

  const orbA = useOrbAnim(ORB_DURATION_A, 24, -32, 1.12);
  const orbB = useOrbAnim(ORB_DURATION_B, -28, 20, 1.18);
  const orbC = useOrbAnim(ORB_DURATION_C, 16, 28, 1.08);

  // Mascot breathing + gentle float
  const breath = useSharedValue(0);
  const float = useSharedValue(0);
  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    float.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [breath, float]);
  const mascotAnim = useAnimatedStyle(() => ({
    transform: [
      { translateY: -6 + float.value * 12 },
      { scale: 1 + breath.value * 0.04 },
    ],
  }));

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface.primary }}>
      {/* Background animated orbs */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: -60,
            left: -40,
            width: 280,
            height: 280,
            borderRadius: 9999,
            backgroundColor: theme.colors.accent.muted,
            opacity: 0.45,
          },
          orbA,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 180,
            right: -80,
            width: 240,
            height: 240,
            borderRadius: 9999,
            backgroundColor: theme.colors.accent.default,
            opacity: 0.18,
          },
          orbB,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            bottom: 220,
            left: -60,
            width: 200,
            height: 200,
            borderRadius: 9999,
            backgroundColor: theme.colors.border.strong,
            opacity: 0.5,
          },
          orbC,
        ]}
      />

      <Animated.View style={[{ flex: 1, padding: theme.space[5] }, fade]}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Animated.View style={mascotAnim}>
            <NeuroMascot mood="calm" size={450} />
          </Animated.View>
        </View>

        <View
          style={{
            backgroundColor: theme.colors.surface.elevated,
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: theme.colors.border.subtle,
            padding: theme.space[5],
            gap: theme.space[4],
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.08,
            shadowRadius: 16,
            elevation: 6,
          }}
        >
          <View style={{ gap: theme.space[2] }}>
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
                borderRadius: theme.radius.lg,
                alignItems: 'center',
              }}
            >
              <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.accent.onAccent }}>
                {t('welcome.cta')}
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}
