import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { TrendLineChart } from '@/components/charts/TrendLineChart';
import { Skeleton } from '@/components/feedback/Skeleton';
import type { TrendMetric } from '@/services/api/stats';
import { useTheme } from '@/theme';

import { trendQuery } from '../queries';

const METRICS: TrendMetric[] = ['focus', 'energy', 'stress', 'forgetfulness', 'sleep_quality'];
const DAY_OPTIONS = [7, 30, 90];

export function TrendsSection() {
  const theme = useTheme();
  const { t } = useTranslation('common');
  const [metric, setMetric] = useState<TrendMetric>('focus');
  const [days, setDays] = useState<number>(30);

  const { data, isLoading } = useQuery(trendQuery(metric, days));

  const cardStyle = {
    padding: theme.space[5],
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface.elevated,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    gap: theme.space[3],
  } as const;

  return (
    <View style={cardStyle}>
      <Text style={{ ...theme.typography.heading, color: theme.colors.text.primary }}>
        {t('trends.title')}
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
        {METRICS.map((m) => (
          <Chip
            key={m}
            label={t(`trends.metrics.${m}`)}
            active={m === metric}
            onPress={() => setMetric(m)}
          />
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: theme.space[2] }}>
        {DAY_OPTIONS.map((d) => (
          <Chip
            key={d}
            label={t('trends.days', { count: d })}
            active={d === days}
            onPress={() => setDays(d)}
          />
        ))}
      </View>

      {isLoading || !data ? (
        <Skeleton height={140} radius="md" />
      ) : (
        <TrendLineChart data={data.points} min={1} max={5} />
      )}
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: theme.space[3],
        paddingVertical: theme.space[2],
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: active ? theme.colors.border.focus : theme.colors.border.subtle,
        backgroundColor: active ? theme.colors.surface.raised : theme.colors.surface.elevated,
      }}
    >
      <Text style={{ ...theme.typography.caption, color: theme.colors.text.primary }}>
        {label}
      </Text>
    </Pressable>
  );
}
