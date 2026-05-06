import type { ImageSourcePropType } from 'react-native';

export const neuroMoods = {
  calm: require('../../../assets/images/neuro-calm.png'),
  happy: require('../../../assets/images/neuro-happy.png'),
  thinking: require('../../../assets/images/neuro-thinking.png'),
  encouraging: require('../../../assets/images/neuro-encouraging.png'),
  sleepy: require('../../../assets/images/neuro-sleepy.png'),
  sad: require('../../../assets/images/neuro-sad.png'),
} satisfies Record<string, ImageSourcePropType>;

export type NeuroMood = keyof typeof neuroMoods;
