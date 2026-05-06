import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/theme';

import { flipRtl, mapToPoints, pointsToPath } from '../chartUtils';

type Props = {
  data: Array<number | null>;
  width?: number;
  height?: number;
  /** semantic accent — defaults to theme.colors.accent.default */
  color?: string;
  /** lock y axis (e.g. 1..5 for slider metrics) */
  min?: number;
  max?: number;
  strokeWidth?: number;
};

export function Sparkline({
  data,
  width = 80,
  height = 28,
  color,
  min,
  max,
  strokeWidth = 2,
}: Props) {
  const theme = useTheme();
  const { i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';

  const points = mapToPoints(data, width, height, { min, max });
  const flipped = flipRtl(points, width, isRtl);
  const path = pointsToPath(flipped);
  const stroke = color ?? theme.colors.accent.default;

  return (
    <Svg width={width} height={height}>
      <Path
        d={path}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
