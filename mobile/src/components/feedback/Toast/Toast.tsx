import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

export type ToastTone = 'success' | 'warning' | 'danger' | 'info';

export type ToastSpec = {
  id: string;
  message: string; // already-translated text — provider does t() lookup
  tone: ToastTone;
  durationMs?: number;
};

type Props = {
  spec: ToastSpec;
  onDismiss: (id: string) => void;
};

export function Toast({ spec, onDismiss }: Props) {
  const theme = useTheme();
  const translateY = useSharedValue(-40);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withSpring(0, { damping: 18 });
    opacity.value = withTiming(1, { duration: 200 });

    const t = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 200 }, (finished) => {
        if (finished) runOnJS(onDismiss)(spec.id);
      });
    }, spec.durationMs ?? 3000);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.id]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const tone = toneStyle(spec.tone, theme);

  return (
    <Animated.View
      style={[
        {
          marginHorizontal: theme.space[4],
          marginTop: theme.space[2],
          paddingHorizontal: theme.space[4],
          paddingVertical: theme.space[3],
          borderRadius: theme.radius.lg,
          backgroundColor: tone.bg,
          borderWidth: 1,
          borderColor: tone.border,
        },
        animated,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ ...theme.typography.bodyMedium, color: tone.fg, flex: 1 }}>
          {spec.message}
        </Text>
      </View>
    </Animated.View>
  );
}

function toneStyle(tone: ToastTone, theme: ReturnType<typeof useTheme>) {
  switch (tone) {
    case 'success':
      return {
        bg: theme.colors.surface.elevated,
        border: theme.colors.success.default,
        fg: theme.colors.text.primary,
      };
    case 'warning':
      return {
        bg: theme.colors.surface.elevated,
        border: theme.colors.warning.default,
        fg: theme.colors.text.primary,
      };
    case 'danger':
      return {
        bg: theme.colors.surface.elevated,
        border: theme.colors.danger.default,
        fg: theme.colors.text.primary,
      };
    default:
      return {
        bg: theme.colors.surface.elevated,
        border: theme.colors.border.subtle,
        fg: theme.colors.text.primary,
      };
  }
}
