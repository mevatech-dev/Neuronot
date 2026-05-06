import { useEffect } from 'react';
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type Direction = 'forward' | 'backward';

/**
 * Slide+fade transition keyed on a step number. When `step` changes, the new
 * step slides in horizontally (RTL-aware via direction) and fades up.
 * Used for onboarding step transitions.
 */
export function useSlideTransition(step: number, direction: Direction = 'forward') {
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(direction === 'forward' ? 24 : -24);

  useEffect(() => {
    opacity.value = 0;
    translateX.value = direction === 'forward' ? 24 : -24;
    opacity.value = withTiming(1, { duration: 280 });
    translateX.value = withTiming(0, { duration: 280 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));
}
