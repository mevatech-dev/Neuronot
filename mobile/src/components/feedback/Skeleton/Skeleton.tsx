import { useEffect } from 'react';
import type { ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

type Radius = 'sm' | 'md' | 'lg' | 'xl' | 'full' | 'none';

type Props = {
  width?: ViewStyle['width'];
  height?: ViewStyle['height'];
  radius?: Radius;
  style?: ViewStyle;
};

export function Skeleton({ width = '100%', height = 16, radius = 'md', style }: Props) {
  const theme = useTheme();
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(1, { duration: 700 }), withTiming(0.5, { duration: 700 })),
      -1,
      false,
    );
  }, [opacity]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: theme.radius[radius],
          backgroundColor: theme.colors.surface.elevated,
        },
        animated,
        style,
      ]}
    />
  );
}
