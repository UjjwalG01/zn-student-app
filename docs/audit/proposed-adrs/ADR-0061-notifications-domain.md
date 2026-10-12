# ADR-0061 — Notifications Domain (Full Push)

## Status

**Accepted** — 2026-10-12, on the owner's instruction "APPROVE THE ADRS AND MOVE TO PHASE 2". Written on the owner's decision NEW-2 = **full push domain** (the poll-based interim option was explicitly dropped). Acceptance authorizes the *design*; implementation occurs in backend **Phase 2C**, sequenced after Phase 2B, under its own acceptance gate (docs/audit/IMPLEMENTATION_ROADMAP.md). No code has been written. Package note: `expo-notifications` and any server-side push provider SDK are **not yet installed** — the owner previously flagged these need explicit go-ahead before Phase 2C mobile work starts.

---

## Context

The migrated app must deliver school-initiated alerts (fee due reminders, result publication, attendance alerts) to guardians. Verified at backend v1.1.0 (`5e57b1b`): there is **no notification module, no device-token storage, no FCM/Expo-push code anywhere** in `apps/api/src` or `docs/api/ENDPOINTS.md` — this domain is genuinely net-new. The legacy Base44 app had no working push either (audited; nothing to preserve).

A poll interim was considered and rejected by the owner in favor of a proper domain, accepting that this is the largest single backend item of the migration.

## Options Considered

- **A. Full notifications domain** — persisted notification records + device tokens + Expo push integration + school-initiated sends via the existing scheduled-job framework. *(Chosen — NEW-2 approved.)*
- **B. Poll-based due-state on dashboard reads.** Rejected by owner; retained only as documented fallback if Phase 2C slips past dependent phases.
- **C. Direct FCM/APNs integration without Expo.** Rejected: app is Expo-managed (CNG/EAS); Expo push service fits the toolchain and abstracts provider keys.

## Decisions

### D1. Schema (additive, tenant-scoped where applicable)

- `notifications (id, tenant_id, kind, title, body, payload jsonb, audience_spec jsonb, created_by, created_at, sent_at NULL, status)` — one row per school-initiated alert; `audience_spec` resolves to concrete recipients at send time (guardian links / membership holders), never stores student PII beyond IDs.
- `notification_deliveries (id, notification_id, user_id, device_token_id, state [pending|sent|failed|clicked], updated_at)` — per-recipient fan-out record; provides idempotency anchor and read/click analytics.
- `device_tokens (id, user_id, expo_push_token unique, platform, app_build, created_at, last_seen_at, invalid_at NULL)` — PII-adjacent; token marked invalid on provider rejection (token-unregistered responses) rather than deleted, for auditability.
- All tenant-visible tables registered in the RLS registry with `withTenantContext` (ADR-0007/0014). `device_tokens` is user-scoped, not tenant-scoped — access enforced through the owning user's guard path.

### D2. Send pipeline

- School staff create notifications through new admin routes (`POST /notifications` etc., permission-gated, web-admin first).
- Fan-out runs through the **scheduled-job framework (ADR-0056)**: resolve audience → materialize deliveries → batch-submit to Expo push service → record provider ticket IDs → reconcile outcomes on a follow-up job.
- Idempotency: repeated sends of the same notification row reuse stored deliveries/tickets (no duplicate pushes); manual re-send requires an explicit new version or reset action.
- Rate limiting/back-off honors Expo push limits; failures retried with bounded exponential back-off, then marked `failed`.

### D3. Mobile contract

- Token registration: app obtains an Expo push token on login/session restore and `POST /portal/devices/token` (idempotent upsert; stale tokens pruned); removed on logout-if-desired and when enrollment revoked.
- Notification payload: `{notificationId, kind, deepLink}` — deep links route inside the guardian portal (student detail, invoices list); untrusted-payload rule: client validates `kind`/route allowlist before navigating.
- Preferences: per-kind mute toggles stored server-side (`user_notification_preferences`) so they survive reinstall.
- Offline posture unchanged (D-5 online-only): push is a wake signal; the app always refetches authoritative data on tap — no data carried in payloads beyond IDs.

### D4. Security constraints

- Push payloads must contain **no PII** (names, amounts, attendance facts) — titles remain generic ("New result published"); details load post-authentication.
- Delivery fan-out computed server-side from linkage/membership rows; a client can never address another user's device.
- Provider credentials (Expo push key / APNs/FCM keys if self-managed later) live in server env config only — never in the app bundle.

## Consequences

- **Backend impact:** three+ new tables, one module, admin CRUD routes, device-token endpoint, two scheduled jobs (fan-out, reconciliation). Largest net-new scope of the migration; risk register entry retained.
- **Mobile impact:** Phase 3 gains a token-registration hook; Phase 5 alert surfaces consume real delivery state. Requires `expo-notifications` install approval (outstanding).
- **Web impact:** school-admin compose UI needed for value realization; tracked as part of Phase 2C scope but shippable after API lands.
- **Migration/rollback:** additive domain; rollback disables jobs and revokes all device tokens (users silently fall back to in-app reads). No dependency from other phases' correctness onto push (fallback B documented).

## Testing Requirements (Phase 2C acceptance gate)

1. Fan-out isolation: guardian A never receives tenant-B or non-linked-student notifications.
2. Idempotency: replayed job produces zero duplicate deliveries; provider-ticket reconciliation updates states.
3. Token lifecycle: invalid-token response marks `invalid_at`; re-register restores; logout/revocation paths tested.
4. Payload privacy test: no PII fields in emitted push JSON (snapshot assertion).
5. Deep-link allowlist: unknown `kind`/route ignored safely on client.
6. End-to-end staging push to a physical/virtual device with EAS build.
7. RLS suites extended for new tenant-scoped tables; existing suites green.
