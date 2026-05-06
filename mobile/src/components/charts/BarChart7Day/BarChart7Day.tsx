import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { useTheme } from '@/theme';

type Bar = {
  /** ISO date — used only as key + RTL ordering */
  date: string;
  /** null = no log that day → empty bar slot */
  value: number | null;
};

type Props = {
  data: Bar[];
  /** lock the value range — slider metrics are 1..5 */
  min?: number;
  max?: number;
  width?: number;
  height?: number;
  color?: string;
};

export function BarChart7Day({
  data,
  min = 1,
  max = 5,
  width = 280,
  height = 120,
  color,
}: Props) {
  const theme = useTheme();
  const { i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';

  const visible = isRtl ? [...data].reverse() : data;
  const fill = color ?? theme.colors.accent.default;
  const empty = theme.colors.surface.raised;

  const padding = 8;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const barW = innerW / visible.length - 6;

  return (
    <View>
      <Svg width={width} height={height}>
        {visible.map((b, i) => {
          const x = padding + i * (innerW / visible.length) + 3;
          if (b.value == null) {
            return (
              <Rect
                key={b.date}
                x={x}
                y={padding + innerH - 4}
                width={barW}
                height={4}
                rx={2}
                fill={empty}
              />
            );
          }
          const norm = Math.max(0, Math.min(1, (b.value - min) / (max - min)));
          const h = Math.max(4, norm * innerH);
          return (
            <Rect
              key={b.date}
              x={x}
              y={padding + innerH - h}
              width={barW}
              height={h}
              rx={3}
              fill={fill}
            />
          );
        })}
      </Svg>
    </View>
  );
}
