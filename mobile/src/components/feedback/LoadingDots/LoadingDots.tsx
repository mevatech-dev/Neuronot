import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

type Props = {
  size?: number;
  color?: string;
};

export function LoadingDots({ size = 8, color }: Props) {
  const theme = useTheme();
  const dotColor = color ?? theme.colors.accent.default;

  return (
    <View style={{ flexDirection: 'row', gap: size }}>
      <Dot size={size} color={dotColor} delay={0} />
      <Dot size={size} color={dotColor} delay={150} />
      <Dot size={size} color={dotColor} delay={300} />
    </View>
  );
}

function Dot({ size, color, delay }: { size: number; color: string; delay: number }) {
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(withTiming(1, { duration: 350 }), withTiming(0.3, { duration: 350 })),
        -1,
        false,
      ),
    );
  }, [delay, opacity]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        animated,
      ]}
    />
  );
}
