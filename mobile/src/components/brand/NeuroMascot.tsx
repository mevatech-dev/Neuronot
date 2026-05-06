import { Image, View } from 'react-native';

import { useTheme } from '@/theme';

import { neuroMoods, type NeuroMood } from './neuroAssets';

export type { NeuroMood } from './neuroAssets';

type Props = {
  mood?: NeuroMood;
  size?: number;
  framed?: boolean;
  accessibilityLabel?: string;
};

export function NeuroMascot({
  mood = 'calm',
  size = 96,
  framed = false,
  accessibilityLabel,
}: Props) {
  const theme = useTheme();
  const image = (
    <Image
      source={neuroMoods[mood]}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      style={{ width: size, height: size }}
    />
  );

  if (!framed) return image;

  return (
    <View
      style={{
        width: size + theme.space[4],
        height: size + theme.space[4],
        borderRadius: theme.radius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.surface.elevated,
        borderWidth: 1,
        borderColor: theme.colors.border.subtle,
      }}
    >
      {image}
    </View>
  );
}
