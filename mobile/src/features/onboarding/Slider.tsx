import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/theme';

type Props = {
  value?: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  lowLabel?: string;
  highLabel?: string;
};

/**
 * Discrete tap-segment "slider" — finger-friendly, no gesture state, no jitter.
 * Five segments (1–5) match the daily-log scale; min defaults to 1.
 */
export function SegmentScale({ value, onChange, min = 1, max = 5, lowLabel, highLabel }: Props) {
  const theme = useTheme();
  const segments = [];
  for (let i = min; i <= max; i++) segments.push(i);

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: theme.space[2] }}>
        {segments.map((s) => {
          const active = value === s;
          return (
            <Pressable
              key={s}
              onPress={() => onChange(s)}
              style={{
                flex: 1,
                aspectRatio: 1,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: active ? theme.colors.border.focus : theme.colors.border.subtle,
                backgroundColor: active ? theme.colors.accent.muted : theme.colors.surface.elevated,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  ...theme.typography.heading,
                  color: active ? theme.colors.accent.onAccent : theme.colors.text.secondary,
                }}
              >
                {s}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {(lowLabel || highLabel) && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.space[2] }}>
          <Text style={{ ...theme.typography.micro, color: theme.colors.text.muted }}>{lowLabel}</Text>
          <Text style={{ ...theme.typography.micro, color: theme.colors.text.muted }}>{highLabel}</Text>
        </View>
      )}
    </View>
  );
}
