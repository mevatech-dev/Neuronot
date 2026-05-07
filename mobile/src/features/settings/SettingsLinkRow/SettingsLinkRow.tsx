import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/theme';

type Props = {
  icon: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
};

export function SettingsLinkRow({ icon, label, onPress, danger = false }: Props) {
  const theme = useTheme();
  const foreground = danger ? theme.colors.danger.default : theme.colors.text.primary;
  const mutedForeground = danger ? theme.colors.danger.muted : theme.colors.text.muted;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[3],
        padding: theme.space[4],
        borderRadius: theme.radius.md,
        backgroundColor: pressed ? theme.colors.surface.raised : theme.colors.surface.elevated,
        borderWidth: 1,
        borderColor: danger ? theme.colors.danger.muted : theme.colors.border.subtle,
      })}
    >
      <Text
        style={{
          ...theme.typography.bodyMedium,
          color: mutedForeground,
          width: theme.space[6],
          textAlign: 'center',
        }}
      >
        {icon}
      </Text>
      <Text
        style={{
          ...theme.typography.bodyMedium,
          color: foreground,
          flex: 1,
        }}
      >
        {label}
      </Text>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={{
          width: theme.space[5],
          alignItems: 'flex-end',
        }}
      >
        <Text style={{ ...theme.typography.bodyMedium, color: mutedForeground }}>{'>'}</Text>
      </View>
    </Pressable>
  );
}
