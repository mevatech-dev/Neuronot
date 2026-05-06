import { request } from './client';

export type ProfileResponse = {
  user_id: string;
  focus_problem: string | null;
  intensity_level: number | null;
  avg_sleep_hours: number | null;
  caffeine_daily: boolean | null;
  onboarding_completed_at: string | null;
  updated_at: string;
};

export type ProfilePatch = {
  focus_problem?: string;
  intensity_level?: number;
  avg_sleep_hours?: number;
  caffeine_daily?: boolean;
  complete_onboarding?: boolean;
};

export function getProfile() {
  return request<ProfileResponse>({ method: 'GET', url: '/v1/profile' });
}

export function patchProfile(patch: ProfilePatch) {
  return request<ProfileResponse>({ method: 'PATCH', url: '/v1/profile', data: patch });
}
