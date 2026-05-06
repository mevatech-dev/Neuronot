import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

type Props = {
  current: number;
  total: number;
};

/**
 * Thin animated progress bar driven by Reanimated. The fill width animates
 * smoothly when `current` changes — no jump. Uses semantic accent.default
 * over surface.elevated.
 */
export function ProgressBar({ current, total }: Props) {
  const theme = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    const ratio = total > 0 ? Math.max(0, Math.min(1, current / total)) : 0;
    progress.value = withTiming(ratio, { duration: 320 });
  }, [current, total, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View
      style={{
        height: 6,
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.surface.elevated,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={[
          {
            height: '100%',
            backgroundColor: theme.colors.accent.default,
            borderRadius: theme.radius.full,
          },
          fillStyle,
        ]}
      />
    </View>
  );
}
