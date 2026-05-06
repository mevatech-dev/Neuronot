import { useEffect } from 'react';
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type Options = {
  durationMs?: number;
  initialTranslateY?: number;
};

/**
 * Fades in + slight Y translate on mount. Returns an animated style to spread
 * onto an `Animated.View`. Reanimated worklet — runs on UI thread, no jank.
 */
export function useFadeIn(opts: Options = {}) {
  const { durationMs = 250, initialTranslateY = 8 } = opts;
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(initialTranslateY);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: durationMs });
    translateY.value = withTiming(0, { duration: durationMs });
  }, [durationMs, opacity, translateY]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
}
