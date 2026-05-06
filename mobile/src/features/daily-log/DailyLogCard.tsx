import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { getTodayLog, type DailyLogResponse } from '@/services/api/dailylog';
import { useTheme } from '@/theme';

type Props = {
  onTapEmpty: () => void;
};

export function DailyLogCard({ onTapEmpty }: Props) {
  const { t } = useTranslation('daily-log');
  const theme = useTheme();

  const today = useQuery({
    queryKey: ['daily-log', 'today'],
    queryFn: getTodayLog,
    staleTime: 60_000,
  });

  if (today.isLoading) return null;

  const log: DailyLogResponse | null | undefined = today.data;

  if (!log) {
    return (
      <Pressable
        onPress={onTapEmpty}
        style={{
          padding: theme.space[5],
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: theme.colors.border.subtle,
          backgroundColor: theme.colors.surface.elevated,
        }}
      >
        <Text style={{ ...theme.typography.micro, color: theme.colors.text.muted }}>
          {t('card.today')}
        </Text>
        <Text
          style={{
            ...theme.typography.heading,
            color: theme.colors.text.primary,
            marginTop: theme.space[1],
          }}
        >
          {t('card.empty_cta')}
        </Text>
      </Pressable>
    );
  }

  return (
    <View
      style={{
        padding: theme.space[5],
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surface.elevated,
        borderWidth: 1,
        borderColor: theme.colors.border.subtle,
      }}
    >
      <Text style={{ ...theme.typography.micro, color: theme.colors.text.muted }}>
        {t('card.today')}
      </Text>
      <Text
        style={{
          ...theme.typography.heading,
          color: theme.colors.text.primary,
          marginTop: theme.space[1],
        }}
      >
        {t('card.summary', { focus: log.focus, energy: log.energy })}
      </Text>
    </View>
  );
}
