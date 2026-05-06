import Constants from 'expo-constants';
import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';

import { useAuthStore } from '@/store/auth';

const baseURL =
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ??
  'http://localhost:8080';

export const apiClient = axios.create({
  baseURL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Refresh-on-401 with single-flight de-dup so concurrent 401s share one refresh call.
let refreshInFlight: Promise<string | null> | null = null;

apiClient.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    if (!original || error.response?.status !== 401 || original._retried) {
      return Promise.reject(error);
    }
    if (original.url?.includes('/v1/auth/')) {
      return Promise.reject(error);
    }

    original._retried = true;
    if (!refreshInFlight) {
      refreshInFlight = useAuthStore
        .getState()
        .refreshTokens()
        .finally(() => {
          refreshInFlight = null;
        });
    }
    const newAccess = await refreshInFlight;
    if (!newAccess) {
      return Promise.reject(error);
    }
    original.headers.Authorization = `Bearer ${newAccess}`;
    return apiClient.request(original);
  },
);

export type ApiEnvelope<T> = {
  data: T | null;
  error: { code: string; message_key: string; message: string } | null;
};

export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const res = await apiClient.request<ApiEnvelope<T>>(config);
  if (res.data.error) {
    throw new ApiError(res.data.error.code, res.data.error.message_key, res.data.error.message);
  }
  if (res.data.data === null) {
    throw new ApiError('EMPTY_RESPONSE', 'errors.generic.internal_error', 'Empty response');
  }
  return res.data.data;
}

/**
 * Some endpoints legitimately return `data: null` (e.g. /v1/daily-logs/today
 * before any log exists). Use this variant to surface that as `null` rather
 * than an EMPTY_RESPONSE exception.
 */
export async function requestNullable<T>(config: AxiosRequestConfig): Promise<T | null> {
  const res = await apiClient.request<ApiEnvelope<T>>(config);
  if (res.data.error) {
    throw new ApiError(res.data.error.code, res.data.error.message_key, res.data.error.message);
  }
  return res.data.data;
}

export class ApiError extends Error {
  constructor(public code: string, public messageKey: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}
