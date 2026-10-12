// lib/api/types.ts
// Typed contracts mirroring the verified ZN backend v1.1.0 API surface.
// Sources: docs/api/ENDPOINTS.md + controller/DTO inspection at commit 5e57b1b
// (see docs/audit/API_MIGRATION_MATRIX.md for the per-route evidence trail).

/** Normalized client-side error union produced by the API layer. */
export type ApiErrorKind =
  | 'network'      // fetch threw / offline / DNS
  | 'timeout'      // aborted via timeout signal
  | 'unauthorized' // 401 — token missing/expired; triggers refresh attempt
  | 'forbidden'    // 403 — authenticated but not permitted / wrong tenant / unlinked student
  | 'notfound'     // 404
  | 'conflict'     // 409 — e.g. duplicate userId claim (ADR-0059 D2)
  | 'validation'   // 400/422 — DTO validation failure
  | 'rate-limit'   // 429
  | 'server'       // 5xx
  | 'unknown';

export interface ApiError {
  kind: ApiErrorKind;
  status?: number;
  /** Server message when safe to display; otherwise a generic fallback. */
  message: string;
  /** Field-level errors from class-validator whitelists, when present. */
  fields?: Record<string, string[]>;
  /** Raw correlation/request id if the backend emits one (never contains secrets). */
  requestId?: string;
}

export function isApiError(e: unknown): e is ApiError {
  return !!e && typeof e === 'object' && 'kind' in e && 'message' in e;
}

/** Discriminated result type used by all service modules. */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

// ---------------------------------------------------------------------------
// Identity (existing, verified routes)
// ---------------------------------------------------------------------------

export interface LoginRequest {
  email: string;
  password: string;
  /** ADR-0060: device identifier for first-login OTP enrollment. Optional until endpoints ship. */
  deviceId?: string;
}

/** Live backend response (v1.1.0, verified in identity.controller.ts): ONLY the token pair.
 *  `user` is populated client-side from GET /identity/me after a successful login. */
export interface LoginResponseActive {
  enrollment?: 'active';
  accessToken: string;
  refreshToken: string;
  user?: IdentityUser;
}

/** ADR-0060 pending branch — no session material issued yet.
 *  NOTE (Phase 2 correction, verified against backend v1.1.0 source): the live
 *  POST /identity/login response is ONLY `{accessToken, refreshToken}` — there
 *  is no `user` property and no OTP branch until Phase 2C ships ADR-0060.
 *  The `user` field below is therefore optional on the active branch and is
 *  populated client-side from GET /identity/me after login. */
export interface LoginResponsePendingOtp {
  enrollment: 'pending';
  /** Interim in-memory-only handle until the ADR-0060 contract publishes its real shape. */
  otpToken: string;
}

export type LoginResponse = LoginResponseActive | LoginResponsePendingOtp;

/** Client-normalized identity (mapped from the flat IdentityMeResponse). */
export interface IdentityUser {
  id: string;
  email: string;
  name?: string;
  isPlatformAdmin?: boolean;
  /** Backend-computed inactivity window (ADR-0022 amendment) — drives NEW-6 idle timeout. */
  sessionTimeoutMinutes?: number;
}

/** GET /identity/me — verified response shape (backend docs/api/ENDPOINTS.md §1, v1.1.0).
 *  Flat object, NOT `{user}`. `sessionTimeoutMinutes` is backend-computed
 *  (ADR-0022 amendment) and drives the client inactivity window. */
export interface IdentityMeResponse {
  id: string;
  email: string;
  fullName: string;
  isPlatformAdmin: boolean;
  sessionTimeoutMinutes?: number;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

// ---------------------------------------------------------------------------
// Tenancy (staff-facing; guardians are excluded per ADR-0059 D3)
// ---------------------------------------------------------------------------

export interface SchoolSummary {
  tenantId: string;
  name: string;
  role?: string;
  permissions?: string[];
}

// ---------------------------------------------------------------------------
// Guardian portal (ADR-0059 — Phase 2B, GET-only)
// ---------------------------------------------------------------------------

export interface PortalGuardianMe {
  guardianId: string;
  tenantId: string;
  name: string;
  email?: string;
  phone?: string;
  students: PortalStudentRow[];
}

export interface PortalStudentRow {
  studentId: string;
  displayName: string;
  admissionNo?: string;
  className?: string;
  section?: string;
  relationship: string;
  billingMode: 'combined' | 'separate';
}

export interface PortalStudentProfile {
  student: Record<string, unknown>;
  enrollment?: Record<string, unknown>;
  school?: { id: string; name: string };
  [key: string]: unknown;
}

export interface Paginated<T> {
  data: T[];
  page?: number;
  pageSize?: number;
  total?: number;
  hasMore?: boolean;
}

export interface AttendanceRecordRow {
  id: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused' | string;
  period?: number;
  remarks?: string;
}

export interface ExamResultRow {
  examId: string;
  examName: string;
  academicYear?: string;
  publishedAt?: string;
  subjects?: Array<{ subject: string; marks?: number; maxMarks?: number; grade?: string }>;
  total?: number;
  percentage?: number;
}

export interface InvoiceRow {
  id: string;
  invoiceNo?: string;
  title?: string;
  amount: number;
  balanceDue?: number;
  dueDate?: string;
  status: string;
  studentIds?: string[];
}

export interface PaymentRow {
  id: string;
  paidAt: string;
  amount: number;
  method?: string;
  receiptNo?: string;
  invoiceId?: string;
}

// ---------------------------------------------------------------------------
// Notifications (ADR-0061 — Phase 2C; contract provisional)
// ---------------------------------------------------------------------------

export interface DeviceTokenRegistration {
  expoPushToken: string;
  platform: 'ios' | 'android';
  appBuild?: string;
}
