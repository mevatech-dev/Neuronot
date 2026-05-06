import { apiClient, request, type ApiEnvelope } from '../client';

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  access_expires_at: string;
  refresh_expires_at: string;
  user_id: string;
  email: string;
  preferred_language: string;
};

export function register(email: string, password: string, preferredLanguage?: string) {
  return request<TokenResponse>({
    method: 'POST',
    url: '/v1/auth/register',
    data: { email, password, preferred_language: preferredLanguage },
  });
}

export function login(email: string, password: string) {
  return request<TokenResponse>({
    method: 'POST',
    url: '/v1/auth/login',
    data: { email, password },
  });
}

// Lower-level call used by the refresh interceptor — bypasses the typed
// envelope unwrap so a refresh-time error doesn't trigger ApiError -> retry loops.
export async function refresh(refreshToken: string): Promise<TokenResponse | null> {
  try {
    const res = await apiClient.post<ApiEnvelope<TokenResponse>>('/v1/auth/refresh', {
      refresh_token: refreshToken,
    });
    return res.data.data;
  } catch {
    return null;
  }
}

export function logout(refreshToken: string) {
  return request<{ status: string }>({
    method: 'POST',
    url: '/v1/auth/logout',
    data: { refresh_token: refreshToken },
  });
}
