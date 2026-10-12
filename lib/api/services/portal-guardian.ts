// lib/api/services/portal-guardian.ts
// Guardian portal reads (ADR-0059, ACCEPTED 2026-10-12) — Phase 2B backend work.
// These routes DO NOT EXIST YET on v1.1.0; this module is the approved contract
// stub so Phase 3 UI can be built against types and mocked in tests.
// Every request carries explicit tenantId per ADR-0004 convention.

import { api } from '../client';
import type {
  ApiResult,
  AttendanceRecordRow,
  ExamResultRow,
  InvoiceRow,
  Paginated,
  PaymentRow,
  PortalGuardianMe,
  PortalStudentProfile,
  PortalStudentRow,
} from '../types';

function tq(tenantId: string, extra?: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams({ tenantId });
  if (extra) {
    for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== '') params.set(k, String(v));
  }
  return `?${params.toString()}`;
}

export const portalGuardianService = {
  me: (tenantId: string) =>
    api.get<PortalGuardianMe>(`/portal/guardian/me${tq(tenantId)}`),

  students: (tenantId: string) =>
    api.get<PortalStudentRow[]>(`/portal/guardian/students${tq(tenantId)}`),

  studentProfile: (tenantId: string, studentId: string) =>
    api.get<PortalStudentProfile>(`/portal/guardian/students/${studentId}/profile${tq(tenantId)}`),

  attendance: (tenantId: string, studentId: string, page = 1, pageSize = 30) =>
    api.get<Paginated<AttendanceRecordRow>>(
      `/portal/guardian/students/${studentId}/attendance${tq(tenantId, { page, pageSize })}`,
    ),

  examResults: (tenantId: string, studentId: string) =>
    api.get<ExamResultRow[]>(`/portal/guardian/students/${studentId}/exam-results${tq(tenantId)}`),

  invoices: (tenantId: string, studentId: string) =>
    api.get<InvoiceRow[]>(`/portal/guardian/students/${studentId}/invoices${tq(tenantId)}`),

  payments: (tenantId: string, studentId: string) =>
    api.get<PaymentRow[]>(`/portal/guardian/students/${studentId}/payments${tq(tenantId)}`),
};

// Silence unused-import lint when ApiResult is referenced only in signatures above.
export type _PortalResult<T> = ApiResult<T>;
