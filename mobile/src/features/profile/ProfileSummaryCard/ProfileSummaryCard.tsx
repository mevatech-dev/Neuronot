import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Skeleton } from '@/components/feedback/Skeleton';
import { useTheme } from '@/theme';

type Props = {
  loading: boolean;
  email: string;
  memberSinceISO: string | null;
  focusProblem: string | null;
  intensity: number | null;
  sleepHours: number | null;
  caffeine: boolean | null;
  reminderHour: number | null;
  reminderEnabled: boolean;
};

const EMPTY_VALUE = '—';

export function ProfileSummaryCard({
  loading,
  email,
  memberSinceISO,
  focusProblem,
  intensity,
  sleepHours,
  caffeine,
  reminderHour,
  reminderEnabled,
}: Props) {
  const theme = useTheme();
  const { t, i18n } = useTranslation('settings');

  const cardStyle = {
    padding: theme.space[5],
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface.elevated,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    gap: theme.space[4],
  } as const;

  if (loading) {
    return (
      <View style={cardStyle}>
        <Skeleton height={42} radius="md" />
        <Skeleton height={42} radius="md" />
        <Skeleton height={42} radius="md" />
      </View>
    );
  }

  return (
    <View style={cardStyle}>
      <View style={{ gap: theme.space[1] }}>
        <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.text.primary }}>
          {email}
        </Text>
        {memberSinceISO && (
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted }}>
            {t('profile.member_since', { date: formatMemberSince(memberSinceISO, i18n.language) })}
          </Text>
        )}
      </View>

      <View style={{ gap: theme.space[3] }}>
        <SummaryRow label={t('profile.focus_problem')} value={focusProblem ?? EMPTY_VALUE} />
        <SummaryRow
          label={t('profile.intensity')}
          value={typeof intensity === 'number' ? `${intensity}/5` : EMPTY_VALUE}
        />
        <SummaryRow
          label={t('profile.sleep')}
          value={typeof sleepHours === 'number' ? `${sleepHours} h` : EMPTY_VALUE}
        />
        <SummaryRow label={t('profile.caffeine')} value={formatCaffeine(caffeine, t)} />
        <SummaryRow
          label={t('profile.reminder')}
          value={
            reminderEnabled && typeof reminderHour === 'number'
              ? `${reminderHour.toString().padStart(2, '0')}:00`
              : t('profile.reminder_off')
          }
        />
      </View>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space[3],
      }}
    >
      <Text style={{ ...theme.typography.body, color: theme.colors.text.secondary, flex: 1 }}>
        {label}
      </Text>
      <Text
        style={{
          ...theme.typography.bodyMedium,
          color: theme.colors.text.primary,
          flex: 1,
          textAlign: 'right',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function formatMemberSince(memberSinceISO: string, language: string) {
  const date = new Date(memberSinceISO);
  if (Number.isNaN(date.getTime())) {
    return EMPTY_VALUE;
  }

  return new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(date);
}

function formatCaffeine(
  caffeine: boolean | null,
  t: ReturnType<typeof useTranslation<'settings'>>['t'],
) {
  if (caffeine === true) {
    return t('profile.yes');
  }
  if (caffeine === false) {
    return t('profile.no');
  }
  return EMPTY_VALUE;
}
