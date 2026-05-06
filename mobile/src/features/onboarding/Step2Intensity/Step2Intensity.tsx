import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { SegmentScale } from '@/features/onboarding/Slider';
import { useTheme } from '@/theme';

type Props = {
  value: number | undefined;
  onChange: (next: number) => void;
};

export function Step2Intensity({ value, onChange }: Props) {
  const { t } = useTranslation('onboarding');
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space[4] }}>
      <Text style={{ ...theme.typography.heading, color: theme.colors.text.primary }}>
        {t('step2.title')}
      </Text>
      <SegmentScale
        value={value}
        onChange={onChange}
        min={1}
        max={5}
        lowLabel={t('step2.scale_low')}
        highLabel={t('step2.scale_high')}
      />
    </View>
  );
}
