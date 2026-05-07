import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/theme';

import type { ConsentRecord } from '../types';

type Props = { record: ConsentRecord; onRevoke?: () => void };

export function ConsentRow({ record, onRevoke }: Props) {
  const theme = useTheme();
  const { t, i18n } = useTranslation('consents');

  const status =
    record.granted && !record.isStale
      ? t('status.granted')
      : record.granted && record.isStale
        ? t('status.stale')
        : t('status.revoked');

  const dateLabel = record.occurredAt
    ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(record.occurredAt)
    : '—';

  return (
    <View
      style={{
        padding: theme.space[5],
        backgroundColor: theme.colors.surface.elevated,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: record.isStale ? theme.colors.danger.default : theme.colors.border.subtle,
        marginBottom: theme.space[3],
      }}
    >
      <Text
        style={{
          ...theme.typography.bodyMedium,
          color: theme.colors.text.primary,
          marginBottom: theme.space[1],
        }}
      >
        {t(`types.${record.type}`)}
      </Text>
      <Text
        style={{
          ...theme.typography.caption,
          color: theme.colors.text.muted,
          marginBottom: theme.space[2],
        }}
      >
        {`${status} · ${record.version || '—'} · ${dateLabel}`}
      </Text>
      {record.granted && onRevoke && record.type === 'ai_usage' && (
        <Pressable
          onPress={onRevoke}
          style={{ alignSelf: 'flex-start', paddingVertical: theme.space[2] }}
        >
          <Text style={{ ...theme.typography.body, color: theme.colors.danger.default }}>
            {t('actions.revoke')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
