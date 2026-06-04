// ============================================================
// Repository Layer — single import point
//
// All database access must go through repositories.
// Pages and components must NEVER import prisma directly.
// Only repositories and service files may use prisma.
//
// Architecture:
//   Page/Component → Service → Repository → Prisma
// ============================================================

export { customerRepository } from "./customer.repository";
export { invoiceRepository } from "./invoice.repository";
export { complianceRepository } from "./compliance.repository";
export { integrationRepository } from "./integration.repository";
export { notificationRepository } from "./notification.repository";
export { documentRepository } from "./document.repository";
export { userRepository } from "./user.repository";
export { organizationRepository } from "./organization.repository";
export { paginate, clampTake } from "./base.repository";
export type { PaginatedResult, PaginationInput } from "./base.repository";
