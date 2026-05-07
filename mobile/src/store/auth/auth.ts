import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { login as apiLogin, refresh as apiRefresh, register as apiRegister, logout as apiLogout } from '@/services/api/auth';
import type { RegisterConsentInput, TokenResponse } from '@/services/api/auth';

const ACCESS_KEY = 'neuronot.auth.access';
const REFRESH_KEY = 'neuronot.auth.refresh';
const USER_KEY = 'neuronot.auth.user';

type AuthUser = {
  id: string;
  email: string;
  preferredLanguage: string;
};

type AuthState = {
  hydrated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;

  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    preferredLanguage: string | undefined,
    consents: RegisterConsentInput[],
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<string | null>;
};

async function persistTokens(t: TokenResponse) {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, t.access_token),
    SecureStore.setItemAsync(REFRESH_KEY, t.refresh_token),
    SecureStore.setItemAsync(
      USER_KEY,
      JSON.stringify({ id: t.user_id, email: t.email, preferredLanguage: t.preferred_language }),
    ),
  ]);
}

async function clearTokens() {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ]);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  hydrated: false,
  accessToken: null,
  refreshToken: null,
  user: null,

  hydrate: async () => {
    const [access, refresh, userRaw] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_KEY),
      SecureStore.getItemAsync(REFRESH_KEY),
      SecureStore.getItemAsync(USER_KEY),
    ]);
    set({
      hydrated: true,
      accessToken: access,
      refreshToken: refresh,
      user: userRaw ? (JSON.parse(userRaw) as AuthUser) : null,
    });
  },

  login: async (email, password) => {
    const tokens = await apiLogin(email, password);
    await persistTokens(tokens);
    set({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      user: { id: tokens.user_id, email: tokens.email, preferredLanguage: tokens.preferred_language },
    });
  },

  register: async (email, password, preferredLanguage, consents) => {
    const tokens = await apiRegister(email, password, preferredLanguage, consents);
    await persistTokens(tokens);
    set({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      user: { id: tokens.user_id, email: tokens.email, preferredLanguage: tokens.preferred_language },
    });
  },

  logout: async () => {
    const rt = get().refreshToken;
    if (rt) {
      try {
        await apiLogout(rt);
      } catch {
        // Best-effort — local logout still proceeds.
      }
    }
    await clearTokens();
    set({ accessToken: null, refreshToken: null, user: null });
  },

  refreshTokens: async () => {
    const rt = get().refreshToken;
    if (!rt) return null;
    const tokens = await apiRefresh(rt);
    if (!tokens) {
      await clearTokens();
      set({ accessToken: null, refreshToken: null, user: null });
      return null;
    }
    await persistTokens(tokens);
    set({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      user: { id: tokens.user_id, email: tokens.email, preferredLanguage: tokens.preferred_language },
    });
    return tokens.access_token;
  },
}));
