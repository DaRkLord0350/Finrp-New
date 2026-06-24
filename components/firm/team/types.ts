// Shared DTO types for the firm Team Management module.
// Plain types only (no "use client") so server code can import them too.

export type MemberKind = "user" | "invite";

export interface TeamMember {
  id: string;
  kind: MemberKind;
  name: string | null;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  firmRole: string | null;       // FirmMemberRole
  specialization: string | null; // Specialization
  userRole: string | null;       // platform UserRole (users only)
  joiningDate: string | null;    // ISO
  isActive: boolean;             // invites: true while PENDING
  status: string;                // ACTIVE | INACTIVE | PENDING | EXPIRED | ACCEPTED | REVOKED
  customerCount: number;
  openTaskCount: number;
  defaultPermissions: string[];  // ClientPermission[]
  createdAt: string;             // ISO
  expiresAt: string | null;      // ISO (invites)
}

export interface ActivityEntry {
  id: string;
  action: string;
  actorName: string | null;
  targetEmail: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;             // ISO
}

// Payload shape returned by the import-validate step.
export interface ImportParsedRow {
  row: number;
  name: string;
  email: string;
  phone: string | null;
  firmRole: string;
  specialization: string | null;
}

export interface ImportRowError {
  row: number;
  data: Record<string, string>;
  errors: string[];
}
