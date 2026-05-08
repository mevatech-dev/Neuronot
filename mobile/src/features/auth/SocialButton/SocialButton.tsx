import { Pressable, Text, View } from 'react-native';

import { LoadingDots } from '@/components/feedback/LoadingDots';
import { useTheme } from '@/theme';

export type SocialButtonVariant = 'apple' | 'google' | 'email' | 'ghost';

type Props = {
  variant: SocialButtonVariant;
  label: string;
  onPress: () => void;
  pending?: boolean;
  disabled?: boolean;
  icon?: string;
};

// SocialButton renders the four welcome-screen entries with consistent
// height, radius, and pressed feedback. Apple uses a near-black surface
// with light text per HIG; Google uses surface.elevated with high-contrast
// text; email is the accent button; ghost is the anon link variant.
export function SocialButton({ variant, label, onPress, pending, disabled, icon }: Props) {
  const theme = useTheme();
  const isDisabled = disabled || pending;

  const surfaces = {
    apple: {
      background: '#000000',
      text: '#FFFFFF',
      border: '#000000',
    },
    google: {
      background: theme.colors.surface.elevated,
      text: theme.colors.text.primary,
      border: theme.colors.border.subtle,
    },
    email: {
      background: theme.colors.accent.default,
      text: theme.colors.accent.onAccent,
      border: theme.colors.accent.default,
    },
    ghost: {
      background: 'transparent',
      text: theme.colors.text.muted,
      border: 'transparent',
    },
  } as const;

  const colors = surfaces[variant];
  const isGhost = variant === 'ghost';

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => ({
        backgroundColor: colors.background,
        borderColor: colors.border,
        borderWidth: isGhost ? 0 : 1,
        borderRadius: theme.radius.md,
        paddingVertical: isGhost ? theme.space[3] : theme.space[4],
        opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.space[2],
      })}
    >
      {pending ? (
        <LoadingDots color={colors.text} />
      ) : (
        <>
          {icon && (
            <View style={{ width: theme.space[5], alignItems: 'center' }}>
              <Text style={{ ...theme.typography.bodyMedium, color: colors.text }}>{icon}</Text>
            </View>
          )}
          <Text style={{ ...theme.typography.bodyMedium, color: colors.text }}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}
