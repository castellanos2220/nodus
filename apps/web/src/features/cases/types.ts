import type { CaseStatusCode, Role, SlaStatus } from '@nodus/types';

export interface Paginated<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface CaseListItem {
  id: string;
  code: string;
  title: string;
  status: CaseStatusCode;
  statusLabel: string;
  company: { id: string; name: string };
  areaCode: string | null;
  complexityCode: string | null;
  urgencyCode: string | null;
  impactCode: string | null;
  leadConsultant: { id: string; code: string; fullName: string } | null;
  slaStatus: SlaStatus | null;
  slaDeadline: string | null;
  slaPercentConsumed: number | null;
  openIncidents: number;
  createdAt: string;
  updatedAt: string;
}

export interface AvailableTransition {
  code: string;
  label: string;
  toStatus: CaseStatusCode;
  description: string;
  allowed: boolean;
  blockedBy: string[];
  blockedReason: string | null;
  requiresPayload: boolean;
}

export interface CaseClassificationView {
  id: string;
  areaCode: string;
  subAreaCode: string | null;
  interventionTypeCode: string;
  complexityCode: string;
  impactCode: string;
  urgencyCode: string;
  eligibility: string;
  reviewNotes: string;
  confirmedAt: string | null;
  createdAt: string;
  classifiedBy: { id: string; fullName: string } | null;
}

export interface CaseDetail {
  id: string;
  code: string;
  title: string;
  description: string;
  status: CaseStatusCode;
  statusLabel: string;
  progressPercent: number;
  accessLevel: 'FULL' | 'REDACTED';
  areaCode: string | null;
  subAreaCode: string | null;
  interventionTypeCode: string | null;
  complexityCode: string | null;
  urgencyCode: string | null;
  impactCode: string | null;
  publishedAt: string | null;
  applicationDeadline: string | null;
  decisionOpenedAt: string | null;
  authorizedAt: string | null;
  executionStartedAt: string | null;
  closedAt: string | null;
  closureReason: string | null;
  closureReasonCode: string | null;
  createdAt: string;
  updatedAt: string;
  company: { id: string; code: string; name: string; country: string; city: string };
  contact: {
    id: string;
    fullName: string;
    email: string;
    jobTitle: string;
    phone: string;
  } | null;
  classification: CaseClassificationView | null;
  leadConsultant: {
    id: string;
    code: string;
    tier: string | null;
    user: { fullName: string; email: string };
  } | null;
  assignments: Array<{
    id: string;
    isPrimary: boolean;
    createdAt: string;
    consultant: { id: string; code: string; tier: string | null; user: { fullName: string; email: string } };
  }>;
  sla: {
    id: string;
    stage: string;
    status: SlaStatus;
    startedAt: string;
    deadline: string;
    percentConsumed: number;
    rule: { code: string; name: string };
  } | null;
  counts: {
    documents: number;
    applications: number;
    activities: number;
    milestones: number;
    incidents: number;
    deliverables: number;
    communications: number;
    meetings: number;
    proposalVersions: number;
  };
  availableTransitions: AvailableTransition[];
}

export interface TimelineEntry {
  id: string;
  createdAt: string;
  action: string;
  actionLabel: string;
  entity: string;
  entityId: string | null;
  origin: 'USER' | 'SYSTEM';
  actor: { id: string; fullName: string; role: Role } | null;
  previousValue: unknown;
  newValue: unknown;
  metadata: Record<string, unknown> | null;
}

export interface StatusHistoryEntry {
  id: string;
  previousStatus: CaseStatusCode | null;
  newStatus: CaseStatusCode;
  transitionCode: string;
  note: string | null;
  origin: 'USER' | 'SYSTEM';
  hoursInPreviousStatus: string | null;
  createdAt: string;
  actor: { id: string; fullName: string } | null;
}

export interface LookupValue {
  id: string;
  code: string;
  label: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  metadata: Record<string, unknown> | null;
}

export interface LookupList {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  values: LookupValue[];
}
