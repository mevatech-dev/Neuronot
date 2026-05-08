export type FocusProblem = 'focus' | 'energy' | 'headache' | 'sleep' | 'forgetfulness';

export const FOCUS_PROBLEMS: FocusProblem[] = [
  'focus',
  'energy',
  'headache',
  'sleep',
  'forgetfulness',
];

export type OnboardingState = {
  // Multi-select; first item is sent to backend as the legacy `focus_problem`
  // string until the API contract is widened. UI activates fields based on
  // membership in this list.
  concerns?: FocusProblem[];
  intensityLevel?: number;
  avgSleepHours?: number;
  caffeineDaily?: boolean;
  reminderEnabled?: boolean;
  reminderHour?: number;
  timezone?: string;
};
