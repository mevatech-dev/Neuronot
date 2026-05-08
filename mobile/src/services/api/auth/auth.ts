import { apiClient, request, type ApiEnvelope } from '../client';

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  access_expires_at: string;
  refresh_expires_at: string;
  user_id: string;
  email: string;
  preferred_language: string;
  is_anonymous: boolean;
};

export type RegisterConsentInput = {
  type: 'ai_usage' | 'terms_of_service' | 'privacy_policy';
  granted: boolean;
  version: string;
};

export function register(
  email: string,
  password: string,
  preferredLanguage: string | undefined,
  consents: RegisterConsentInput[],
) {
  return request<TokenResponse>({
    method: 'POST',
    url: '/v1/auth/register',
    data: {
      email,
      password,
      preferred_language: preferredLanguage,
      consents,
    },
  });
}

// signInAnonymous creates a guest account. ToS + Privacy must be granted in
// the consents array; AI usage is optional and gates AI insights later.
export function signInAnonymous(
  preferredLanguage: string | undefined,
  consents: RegisterConsentInput[],
) {
  return request<TokenResponse>({
    method: 'POST',
    url: '/v1/auth/anonymous',
    data: {
      preferred_language: preferredLanguage,
      consents,
    },
  });
}

// signInWithApple posts the native Apple identityToken + raw nonce. The
// server hashes the nonce and compares it to the JWT's `nonce` claim.
export function signInWithApple(
  identityToken: string,
  rawNonce: string,
  preferredLanguage: string | undefined,
  consents: RegisterConsentInput[],
) {
  return request<TokenResponse>({
    method: 'POST',
    url: '/v1/auth/apple',
    data: {
      identity_token: identityToken,
      nonce: rawNonce,
      preferred_language: preferredLanguage,
      consents,
    },
  });
}

export function signInWithGoogle(
  idToken: string,
  preferredLanguage: string | undefined,
  consents: RegisterConsentInput[],
) {
  return request<TokenResponse>({
    method: 'POST',
    url: '/v1/auth/google',
    data: {
      id_token: idToken,
      preferred_language: preferredLanguage,
      consents,
    },
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
