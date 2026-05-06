import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { NeuroMascot, type NeuroMood } from '@/components/brand/NeuroMascot';
import { useTheme } from '@/theme';

type Props = {
  titleKey: string;
  bodyKey?: string;
  actionKey?: string;
  onAction?: () => void;
  mood?: Extract<NeuroMood, 'thinking' | 'encouraging' | 'calm' | 'happy'>;
  size?: number;
};

export function EmptyState({
  titleKey,
  bodyKey,
  actionKey,
  onAction,
  mood = 'thinking',
  size = 96,
}: Props) {
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
      <NeuroMascot mood={mood} size={size} />
      <Text
        style={{
          ...theme.typography.heading,
          color: theme.colors.text.primary,
          textAlign: 'center',
        }}
      >
        {t(titleKey)}
      </Text>
      {bodyKey && (
        <Text
          style={{
            ...theme.typography.body,
            color: theme.colors.text.secondary,
            textAlign: 'center',
          }}
        >
          {t(bodyKey)}
        </Text>
      )}
      {actionKey && onAction && (
        <Pressable
          onPress={onAction}
          style={{
            marginTop: theme.space[2],
            paddingHorizontal: theme.space[5],
            paddingVertical: theme.space[3],
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.accent.default,
          }}
        >
          <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.accent.onAccent }}>
            {t(actionKey)}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
