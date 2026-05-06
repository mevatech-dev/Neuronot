import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { NeuroMascot } from '@/components/brand/NeuroMascot';
import { todayLogQuery } from '@/features/daily-log/queries';
import { type DailyLogResponse } from '@/services/api/dailylog';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme';

type Props = {
  onTapEmpty: () => void;
  /** Called when an existing log is tapped — parent opens the edit sheet. */
  onTapEdit?: (log: DailyLogResponse) => void;
};

export function DailyLogCard({ onTapEmpty, onTapEdit }: Props) {
  const { t } = useTranslation('daily-log');
  const theme = useTheme();
  const userId = useAuthStore((s) => s.user?.id ?? null);

  const today = useQuery({ ...todayLogQuery(userId), staleTime: 60_000 });

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
        <View style={{ alignItems: 'flex-start', marginBottom: theme.space[3] }}>
          <NeuroMascot mood="encouraging" size={72} />
        </View>
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
    <Pressable
      onPress={() => onTapEdit?.(log)}
      disabled={!onTapEdit}
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
      {onTapEdit && (
        <Text
          style={{
            ...theme.typography.caption,
            color: theme.colors.text.muted,
            marginTop: theme.space[2],
          }}
        >
          {t('card.tap_to_edit')}
        </Text>
      )}
    </Pressable>
  );
}
