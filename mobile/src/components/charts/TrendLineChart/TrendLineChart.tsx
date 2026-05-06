import { useTranslation } from 'react-i18next';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { useTheme } from '@/theme';

import { flipRtl, mapToPoints, pointsToPath } from '../chartUtils';

type Point = {
  date: string;
  value: number | null;
};

type Props = {
  data: Point[];
  /** lock the value range — slider metrics are 1..5 */
  min?: number;
  max?: number;
  width?: number;
  height?: number;
  color?: string;
};

export function TrendLineChart({
  data,
  min = 1,
  max = 5,
  width = 320,
  height = 140,
  color,
}: Props) {
  const theme = useTheme();
  const { i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';

  const stroke = color ?? theme.colors.accent.default;
  const grid = theme.colors.border.subtle;

  const padding = 12;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const values = data.map((d) => d.value);
  const points = mapToPoints(values, innerW, innerH, { min, max });
  const flipped = flipRtl(points, innerW, isRtl).map((p) => ({
    x: p.x + padding,
    y: p.y + padding,
  }));
  const path = pointsToPath(flipped);

  return (
    <Svg width={width} height={height}>
      {/* baseline grid */}
      <Line
        x1={padding}
        y1={padding}
        x2={padding}
        y2={padding + innerH}
        stroke={grid}
        strokeWidth={1}
      />
      <Line
        x1={padding}
        y1={padding + innerH}
        x2={padding + innerW}
        y2={padding + innerH}
        stroke={grid}
        strokeWidth={1}
      />
      <Path
        d={path}
        stroke={stroke}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
      {flipped.map((p, i) => {
        if (Number.isNaN(p.y)) return null;
        return <Circle key={i} cx={p.x} cy={p.y} r={2.5} fill={stroke} />;
      })}
    </Svg>
  );
}
