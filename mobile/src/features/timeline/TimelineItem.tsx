import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import type { TimelineItem as ItemT } from '@/services/api/timeline';
import { useTheme } from '@/theme';

import { formatRelative } from './utils';

type Props = { item: ItemT; locale: string };

export function TimelineItem({ item, locale }: Props) {
  const { t } = useTranslation(['daily-log', 'events']);
  const theme = useTheme();
  const at = new Date(item.at);

  return (
    <View
      style={{
        padding: theme.space[4],
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surface.elevated,
        borderWidth: 1,
        borderColor: theme.colors.border.subtle,
        marginBottom: theme.space[2],
      }}
    >
      <Text style={{ ...theme.typography.micro, color: theme.colors.text.muted }}>
        {formatRelative(at, locale)}
      </Text>
      {item.kind === 'daily_log' ? (
        <Text
          style={{
            ...theme.typography.bodyMedium,
            color: theme.colors.text.primary,
            marginTop: theme.space[1],
          }}
        >
          {t('card.summary', { ns: 'daily-log', focus: item.daily_log.focus, energy: item.daily_log.energy })}
        </Text>
      ) : (
        <View>
          <Text
            style={{
              ...theme.typography.bodyMedium,
              color: theme.colors.text.primary,
              marginTop: theme.space[1],
            }}
          >
            {t(`types.${item.event.type}`, { ns: 'events' })}
          </Text>
          <Text
            style={{
              ...theme.typography.caption,
              color: theme.colors.text.secondary,
              marginTop: theme.space[1],
            }}
          >
            {t('card.intensity_short', { ns: 'events', value: item.event.intensity })}
          </Text>
          {item.event.note ? (
            <Text
              style={{
                ...theme.typography.caption,
                color: theme.colors.text.muted,
                marginTop: theme.space[1],
              }}
            >
              {item.event.note}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}
