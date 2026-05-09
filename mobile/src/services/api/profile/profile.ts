import { request } from '../client';

export type ProfileResponse = {
  user_id: string;
  focus_problem: string | null;
  intensity_level: number | null;
  avg_sleep_hours: number | null;
  caffeine_daily: boolean | null;
  onboarding_completed_at: string | null;
  timezone: string;
  reminder_hour: number | null;
  reminder_enabled: boolean;
  avatar_url?: string;
  avatar_expires_at?: string;
  updated_at: string;
};

export type ProfilePatch = {
  focus_problem?: string;
  intensity_level?: number;
  avg_sleep_hours?: number;
  caffeine_daily?: boolean;
  complete_onboarding?: boolean;
  timezone?: string;
  reminder_hour?: number;
  reminder_enabled?: boolean;
  avatar_key?: string;
};

export type AvatarUploadResponse = {
  upload_url: string;
  key: string;
  expires_at: string;
};

export function getProfile() {
  return request<ProfileResponse>({ method: 'GET', url: '/v1/profile' });
}

export function patchProfile(patch: ProfilePatch) {
  return request<ProfileResponse>({ method: 'PATCH', url: '/v1/profile', data: patch });
}

// Returns a Cloudflare R2 pre-signed PUT URL the client uploads bytes to,
// then the caller PATCHes /v1/profile with the returned `key`. content_type
// must be image/jpeg or image/png — backend pins it on the signed URL.
export function requestAvatarUpload(contentType: 'image/jpeg' | 'image/png') {
  return request<AvatarUploadResponse>({
    method: 'POST',
    url: '/v1/profile/avatar',
    data: { content_type: contentType },
  });
}
