// ============================================================
// FinRP — Compliance Module TypeScript Types
// ============================================================

export type ComplianceStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED"
  | "PENDING_RENEWAL";

export type ComplianceApprovalAction =
  | "APPROVE"
  | "REJECT"
  | "REQUEST_CHANGES"
  | "ESCALATE";

export type ComplianceReminderType =
  | "DUE_DATE"
  | "EXPIRY"
  | "PENDING_APPROVAL"
  | "REJECTED_FOLLOW_UP"
  | "RENEWAL"
  | "CUSTOM";

// ── Category ────────────────────────────────────────────────

export interface ComplianceCategoryRecord {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  code: string;
  color: string;
  icon: string;
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { submissions: number; types: number };
}

// ── Type ────────────────────────────────────────────────────

export interface ComplianceTypeRecord {
  id: string;
  organizationId: string;
  categoryId: string;
  name: string;
  description: string | null;
  code: string;
  requiredDocuments: string[];
  validityDays: number | null;
  defaultPenalty: string | null;
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  category?: Pick<ComplianceCategoryRecord, "id" | "name" | "code" | "color" | "icon">;
}

// ── Document (metadata only — binary excluded from lists) ───

export interface ComplianceDocumentMeta {
  id: string;
  organizationId: string;
  submissionId: string | null;
  fileName: string;
  fileExtension: string;
  mimeType: string;
  fileSize: number;
  checksum: string;
  version: number;
  isLatest: boolean;
  documentType: string | null;
  description: string | null;
  uploadedById: string | null;
  uploadedAt: string;
  createdAt: string;
}

// ── Submission ───────────────────────────────────────────────

export interface ComplianceSubmissionRecord {
  id: string;
  organizationId: string;
  categoryId: string;
  typeId: string | null;
  title: string;
  description: string | null;
  referenceNumber: string | null;
  status: ComplianceStatus;
  submissionDate: string | null;
  effectiveDate: string | null;
  expiryDate: string | null;
  dueDate: string | null;
  renewalDate: string | null;
  penaltyAmount: string | null;
  feeAmount: string | null;
  assignedToId: string | null;
  reviewedById: string | null;
  complianceData: Record<string, unknown> | null;
  version: number;
  tags: string[];
  notes: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  category?: Pick<ComplianceCategoryRecord, "id" | "name" | "code" | "color" | "icon">;
  type?: Pick<ComplianceTypeRecord, "id" | "name" | "code"> | null;
  documents?: ComplianceDocumentMeta[];
  approvals?: ComplianceApprovalRecord[];
  statusHistory?: ComplianceStatusHistoryRecord[];
  reminders?: ComplianceReminderRecord[];
  deadlines?: ComplianceDeadlineRecord[];
  auditLogs?: ComplianceAuditLogRecord[];
  _count?: { documents: number; approvals: number };
}

// ── Approval ────────────────────────────────────────────────

export interface ComplianceApprovalRecord {
  id: string;
  organizationId: string;
  submissionId: string;
  action: ComplianceApprovalAction;
  comments: string | null;
  conditions: string | null;
  approvedById: string | null;
  approvedAt: string;
  createdAt: string;
}

// ── Reminder ────────────────────────────────────────────────

export interface ComplianceReminderRecord {
  id: string;
  organizationId: string;
  submissionId: string | null;
  type: ComplianceReminderType;
  title: string;
  message: string | null;
  reminderDate: string;
  isTriggered: boolean;
  triggeredAt: string | null;
  assignedToId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  submission?: Pick<ComplianceSubmissionRecord, "id" | "title" | "status"> | null;
}

// ── Deadline ─────────────────────────────────────────────────

export interface ComplianceDeadlineRecord {
  id: string;
  organizationId: string;
  submissionId: string | null;
  title: string;
  description: string | null;
  deadlineDate: string;
  gracePeriodDays: number;
  isCompleted: boolean;
  completedAt: string | null;
  penaltyPerDay: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Audit Log ────────────────────────────────────────────────

export interface ComplianceAuditLogRecord {
  id: string;
  organizationId: string;
  submissionId: string | null;
  action: string;
  description: string;
  performedById: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

// ── Status History ───────────────────────────────────────────

export interface ComplianceStatusHistoryRecord {
  id: string;
  organizationId: string;
  submissionId: string;
  fromStatus: ComplianceStatus | null;
  toStatus: ComplianceStatus;
  reason: string | null;
  comments: string | null;
  changedById: string | null;
  changedAt: string;
}

// ── Dashboard ────────────────────────────────────────────────

export interface ComplianceDashboardStats {
  totalSubmissions: number;
  pendingApprovals: number;
  expiringSoon: number;
  overdueFiling: number;
  rejectedItems: number;
  approvedItems: number;
  draftItems: number;
  submittedItems: number;
}

export interface ComplianceMonthlyTrend {
  month: string;
  submitted: number;
  approved: number;
  rejected: number;
  expired: number;
}

export interface ComplianceCategoryDistribution {
  categoryName: string;
  code: string;
  count: number;
  color: string;
}

export interface ComplianceDashboardData {
  stats: ComplianceDashboardStats;
  monthlyTrend: ComplianceMonthlyTrend[];
  categoryDistribution: ComplianceCategoryDistribution[];
  recentSubmissions: ComplianceSubmissionRecord[];
  upcomingDeadlines: ComplianceDeadlineRecord[];
  pendingReminders: ComplianceReminderRecord[];
  expiringItems: ComplianceSubmissionRecord[];
}

// ── Input types ──────────────────────────────────────────────

export interface CreateComplianceCategoryInput {
  name: string;
  description?: string | null;
  code: string;
  color?: string;
  icon?: string;
  sortOrder?: number;
}

export interface UpdateComplianceCategoryInput {
  name?: string;
  description?: string | null;
  color?: string;
  icon?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export interface CreateComplianceTypeInput {
  categoryId: string;
  name: string;
  description?: string | null;
  code: string;
  requiredDocuments?: string[];
  validityDays?: number | null;
  defaultPenalty?: number | null;
  sortOrder?: number;
}

export interface UpdateComplianceTypeInput {
  name?: string;
  description?: string | null;
  requiredDocuments?: string[];
  validityDays?: number | null;
  defaultPenalty?: number | null;
  isActive?: boolean;
  sortOrder?: number;
}

export interface CreateComplianceSubmissionInput {
  categoryId: string;
  typeId?: string | null;
  title: string;
  description?: string | null;
  referenceNumber?: string | null;
  status?: ComplianceStatus;
  submissionDate?: string | null;
  effectiveDate?: string | null;
  expiryDate?: string | null;
  dueDate?: string | null;
  renewalDate?: string | null;
  penaltyAmount?: number | null;
  feeAmount?: number | null;
  assignedToId?: string | null;
  complianceData?: Record<string, unknown> | null;
  tags?: string[];
  notes?: string | null;
}

export interface UpdateComplianceSubmissionInput {
  title?: string;
  description?: string | null;
  referenceNumber?: string | null;
  status?: ComplianceStatus;
  submissionDate?: string | null;
  effectiveDate?: string | null;
  expiryDate?: string | null;
  dueDate?: string | null;
  renewalDate?: string | null;
  penaltyAmount?: number | null;
  feeAmount?: number | null;
  assignedToId?: string | null;
  reviewedById?: string | null;
  complianceData?: Record<string, unknown> | null;
  tags?: string[];
  notes?: string | null;
}

export interface ApproveComplianceInput {
  action: ComplianceApprovalAction;
  comments?: string | null;
  conditions?: string | null;
}

export interface CreateComplianceReminderInput {
  submissionId?: string | null;
  type: ComplianceReminderType;
  title: string;
  message?: string | null;
  reminderDate: string;
  assignedToId?: string | null;
}

export interface SubmissionsQueryParams {
  status?: ComplianceStatus;
  categoryId?: string;
  typeId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "createdAt" | "dueDate" | "expiryDate" | "title";
  sortOrder?: "asc" | "desc";
  includeDeleted?: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
