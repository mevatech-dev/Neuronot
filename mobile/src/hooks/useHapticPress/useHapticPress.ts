import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

type Intensity = 'light' | 'medium' | 'heavy';

/**
 * Wraps press feedback: subtle scale-down + haptic on pressIn, scale-up on pressOut.
 * Returns the animated style and the press handlers; spread onto Animated.View
 * + an inner Pressable.
 */
export function useHapticPress(intensity: Intensity = 'light') {
  const scale = useSharedValue(1);

  const onPressIn = useCallback(() => {
    scale.value = withSpring(0.97, { damping: 18 });
    void Haptics.impactAsync(intensityToHaptic(intensity));
  }, [intensity, scale]);

  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 14 });
  }, [scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return { style, onPressIn, onPressOut };
}

function intensityToHaptic(i: Intensity): Haptics.ImpactFeedbackStyle {
  switch (i) {
    case 'medium':
      return Haptics.ImpactFeedbackStyle.Medium;
    case 'heavy':
      return Haptics.ImpactFeedbackStyle.Heavy;
    default:
      return Haptics.ImpactFeedbackStyle.Light;
  }
}
