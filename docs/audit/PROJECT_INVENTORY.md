# PROJECT_INVENTORY — Mobile Repository (`EduPro` / zn-student-app)

Classification: **Verified current implementation** unless noted. Evidence paths are relative to `/workspace`.

## 1. Repository basics
- Package name: `edupro` (`package.json`), app display name **EduPro**, scheme `edupro` (`app.json`).
- Git: single grafted commit `d6527e8 "first commit"`; local branch mirrors `origin/main`; working tree clean at audit start (only `docs/audit/*` added by this audit).
- No CI config, no `.env` files committed; `.gitignore` present.

## 2. Technology stack (verified from `package.json` / lockfile)
| Concern | Choice | Version |
|---|---|---|
| Framework | Expo SDK | ~54.0.34 |
| Runtime | React Native / React | 0.81.5 / 19.1.0 (New Architecture enabled) |
| Language | TypeScript | ~5.9.2 (strict via `tsconfig.json`, expo base) |
| Routing | expo-router (file-based, typed routes experiment on) | ~6.0.23 |
| Legacy backend SDK | `@base44/sdk` | ^0.8.38 |
| Secure storage | `expo-secure-store` | ~15.0.8 |
| Other notable | `react-native-webview` (bus map), `@react-native-async-storage/async-storage` (installed, unused for auth), Reanimated/Gesture Handler/Screens, `expo-clipboard/haptics/image/linking/web-browser` | — |
| PM | npm (`package-lock.json`) | — |

No native `android/`/`ios/` folders → CNG (Continuous Native Generation) / EAS-style managed project.

## 3. Source structure (actual)
```
app/
  _layout.tsx              # Root: ThemeProvider > AuthProvider > StudentProvider > Stack
  modal.tsx                # Starter modal (unused by flows)
  (auth)/student-login.tsx # Only auth screen (email+admission → OTP fallback)
  (tabs)/_layout.tsx       # 5 tabs: Dashboard, Fees, Bus Route, Attendance, Profile
  (tabs)/index.tsx         # Dashboard (aggregate stats from AuthContext)
  (tabs)/transactions.tsx  # Fees — HARDCODED FEE_HEADS mock data
  (tabs)/bus.tsx           # WebView + external WebSocket tracker (to be retired, D-4)
  (tabs)/attendance.tsx    # Attendance history list
  (tabs)/profile.tsx       # Profile + logout
components/                # Starter kit (hello-wave, parallax, themed-*, ui/*) + haptic-tab
constants/                 # theme.ts, error-patterns.ts, tips.ts
contexts/                  # AuthContext.tsx, student-context.tsx, theme-context.tsx
hooks/                     # use-color-scheme(.web), use-fix-screen, use-theme-color
types/error.ts             # Error typing for analyzer
utils/base44.ts            # Base44 client init + dashboard fetch (sole API layer)
utils/error-analyzer.ts    # Dev-only error advisor (remove per D-6)
utils/error-message.ts     # getSafeErrorMessage()
scripts/reset-project.js   # create-expo-app leftover (remove per D-6)
assets/                    # icons/splash images
```

## 4. Build / validation commands
| Command | Exists | Status in audit |
|---|---|---|
| `npm start` / `android` / `ios` / `web` (`expo start …`) | ✅ | Not executed (§17 restriction; requires network/device targets) |
| `npm run lint` (`expo lint`, ESLint 9 flat config `eslint.config.js`) | ✅ | Not executed (would require `npm install`) |
| Typecheck script | ❌ missing | Recommend adding `tsc --noEmit` (D-6) |
| Test script | ❌ missing | No test framework installed; **NEW-5 approved (Jest+jest-expo+typecheck)** — installs happen at Phase 2 |
| `npm run reset-project` | ✅ | Starter leftover; remove (D-6) |
| Builds | EAS not configured in repo | Unknown; no `eas.json` found |

## 5. Configuration & environment
- `app.json`: portrait only, iOS tablet support, Android edge-to-edge, splash plugin, `expo-secure-store` plugin, typedRoutes + reactCompiler experiments.
- Env vars referenced (names only, values never printed): `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_BASE44_APP_ID`, `BASE44_API_KEY` (used in `utils/base44.ts` headers — **non-public var consumed by client bundle = credential-leak risk**; details in LEGACY_BASE44_AUDIT.md §Credentials).
- No `.env.example` present.

## 6. Current technical health
- Small (~2.5k LOC app code), student-only, single aggregate API call pattern.
- Known defects: broken teacher-login link; Fees tab ignores live data (mock); attendance % fallback logic mislabels absent days as present when status fields missing; no token-refresh handling; session-restore failure leaves user logged-out silently; dev logging noise.
- No tests, no CI, no typecheck gate. These drive the Phase-2 foundation work and D-6 housekeeping.
