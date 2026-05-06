import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Sparkline } from '@/components/charts/Sparkline';
import { Skeleton } from '@/components/feedback/Skeleton';
import { useTheme } from '@/theme';

import { weeklySummaryQuery } from '../queries';

export function WeeklySummaryCard() {
  const theme = useTheme();
  const { t } = useTranslation('common');
  const { data, isLoading, isError } = useQuery(weeklySummaryQuery);

  const cardStyle = {
    padding: theme.space[5],
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface.elevated,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    gap: theme.space[3],
  } as const;

  if (isLoading) {
    return (
      <View style={cardStyle}>
        <Skeleton width="40%" height={14} />
        <Skeleton height={28} radius="md" />
        <Skeleton height={56} radius="md" />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={cardStyle}>
        <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted }}>
          {t('summary.title')}
        </Text>
        <Text style={{ ...theme.typography.body, color: theme.colors.text.secondary }}>
          {t('summary.unavailable')}
        </Text>
      </View>
    );
  }

  const focusSeries = data.day_buckets.map((b) => b.focus);
  const energySeries = data.day_buckets.map((b) => b.energy);

  return (
    <View style={cardStyle}>
      <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted }}>
        {t('summary.title')}
      </Text>
      <Text style={{ ...theme.typography.heading, color: theme.colors.text.primary }}>
        {t('summary.log_count', { count: data.log_count })}
      </Text>

      <View style={{ flexDirection: 'row', gap: theme.space[6] }}>
        <Metric label={t('summary.focus_avg')} value={data.focus_avg} series={focusSeries} />
        <Metric label={t('summary.energy_avg')} value={data.energy_avg} series={energySeries} />
      </View>
    </View>
  );
}

function Metric({
  label,
  value,
  series,
}: {
  label: string;
  value: number;
  series: (number | null)[];
}) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, gap: theme.space[1] }}>
      <Text style={{ ...theme.typography.micro, color: theme.colors.text.muted }}>
        {label}
      </Text>
      <Text style={{ ...theme.typography.heading, color: theme.colors.text.primary }}>
        {value > 0 ? value.toFixed(1) : '—'}
      </Text>
      <Sparkline data={series} width={120} height={28} min={1} max={5} />
    </View>
  );
}
