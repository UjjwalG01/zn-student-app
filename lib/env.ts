// lib/env.ts
// Centralized, validated runtime configuration for the ZN backend integration.
// Phase 2 (migration foundation). Values arrive via EXPO_PUBLIC_* build-time env
// vars (.env / EAS environment profiles) — never hardcode URLs or secrets here.

const rawApiUrl = process.env.EXPO_PUBLIC_API_URL ?? '';
const rawTenantId = process.env.EXPO_PUBLIC_TENANT_ID ?? '';

function normalizeBaseUrl(url: string): string {
  // strip trailing slashes so callers can safely append '/identity/login'
  return url.replace(/\/+$/, '');
}

export const ENV = {
  /** Base URL of the ZN NestJS API, e.g. https://api.example.org/api (no trailing slash). */
  apiUrl: normalizeBaseUrl(rawApiUrl),
  /** Default tenant id used by the single-school dev profile; portal responses may override. */
  defaultTenantId: rawTenantId || null,
  /** Feature flag: first-login OTP activation step (ships off until ADR-0060 endpoints land). */
  otpActivationEnabled: process.env.EXPO_PUBLIC_FEATURE_OTP === 'true',
  /** Feature flag: mount the ZN auth provider (Phase 2 foundation) alongside legacy Base44.
   *  Off by default so current builds are byte-for-byte behavior-identical; enable per
   *  profile (.env / EAS) to exercise the new stack. Removed in Phase 6 when legacy dies. */
  znAuthEnabled: process.env.EXPO_PUBLIC_FEATURE_ZN_AUTH === 'true',
} as const;

/** Thrown by assertEnv() when a required variable is missing in this profile. */
export class MissingConfigError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Missing required environment configuration: ${missing.join(', ')}`);
    this.name = 'MissingConfigError';
  }
}

/**
 * Fail-fast validation at app start (called from the root layout effect).
 * Development builds get a loud console warning instead of a crash so the UI
 * remains inspectable; production/preview builds throw.
 */
export function assertEnv(): void {
  const missing: string[] = [];
  if (!ENV.apiUrl) missing.push('EXPO_PUBLIC_API_URL');
  if (missing.length === 0) return;

  const isProd = process.env.EXPO_PUBLIC_ENV === 'production';
  if (isProd) throw new MissingConfigError(missing);
  // eslint-disable-next-line no-console
  console.warn(`[env] ${missing.join(', ')} not set — API calls will fail until configured.`);
}
