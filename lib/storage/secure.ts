// lib/storage/secure.ts
// Thin, typed wrapper over expo-secure-store for ZN session material.
// Two-key policy (docs/audit/AUTH_AND_TENANCY.md §credential storage):
//   zn.accessToken  — short-lived JWT bearer
//   zn.refreshToken — rotating refresh token (NEVER logged, NEVER in AsyncStorage)
// All other persistence layers must stay free of secrets.

import * as SecureStore from 'expo-secure-store';

const KEYS = {
  accessToken: 'zn.accessToken',
  refreshToken: 'zn.refreshToken',
} as const;

async function read(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    // SecureStore can throw on hardware keystore faults; treat as signed-out.
    return null;
  }
}

export const secureStorage = {
  async getAccessToken(): Promise<string | null> {
    return read(KEYS.accessToken);
  },
  async getRefreshToken(): Promise<string | null> {
    return read(KEYS.refreshToken);
  },
  async setTokens(access: string, refresh: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.accessToken, access);
    await SecureStore.setItemAsync(KEYS.refreshToken, refresh);
  },
  async setAccessToken(access: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.accessToken, access);
  },
  /** Wipe-all: used on logout, refresh failure, revoked membership, tenant switch. */
  async clearAll(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.accessToken),
      SecureStore.deleteItemAsync(KEYS.refreshToken),
    ]);
  },
};
