export type FocusProblem = 'focus' | 'energy' | 'headache' | 'sleep' | 'forgetfulness';

export const FOCUS_PROBLEMS: FocusProblem[] = [
  'focus',
  'energy',
  'headache',
  'sleep',
  'forgetfulness',
];

export type OnboardingState = {
  focusProblem?: FocusProblem;
  intensityLevel?: number;
  avgSleepHours?: number;
  caffeineDaily?: boolean;
  reminderEnabled?: boolean;
  reminderHour?: number;
};
