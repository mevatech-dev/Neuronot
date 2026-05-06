import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { NeuroMascot, type NeuroMood } from '@/components/brand/NeuroMascot';
import { useTheme } from '@/theme';

type Props = {
  /** i18n key (with namespace, e.g. "errors.generic.network") */
  messageKey: string;
  /** optional retry callback; when given, renders a retry button */
  onRetry?: () => void;
  /** retry button label key (defaults to common.retry) */
  retryKey?: string;
  /** mood for the mascot — `sad` by default; never `excited`/`playful` here */
  mood?: Extract<NeuroMood, 'sad' | 'calm' | 'thinking'>;
};

export function ErrorState({ messageKey, onRetry, retryKey = 'common.retry', mood = 'sad' }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View
      style={{
        alignItems: 'center',
        gap: theme.space[3],
        padding: theme.space[6],
      }}
    >
      <NeuroMascot mood={mood} size={88} />
      <Text
        style={{
          ...theme.typography.body,
          color: theme.colors.text.secondary,
          textAlign: 'center',
        }}
      >
        {t(messageKey)}
      </Text>
      {onRetry && (
        <Pressable
          onPress={onRetry}
          style={{
            paddingHorizontal: theme.space[5],
            paddingVertical: theme.space[3],
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.surface.elevated,
            borderWidth: 1,
            borderColor: theme.colors.border.subtle,
          }}
        >
          <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.text.primary }}>
            {t(retryKey)}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
