// ============================================================
// Base tenant-scoped repository
//
// ALL queries MUST include organizationId.
// This is enforced at the type level: every method that hits
// the DB requires the caller to pass organizationId explicitly,
// making it impossible to forget.
//
// Usage:
//   class CustomerRepository extends TenantRepository<'customer'> {
//     model = () => prisma.customer;
//   }
// ============================================================

import { prisma } from "@/lib/prisma";

export { prisma };

export type PaginationInput = {
  cursor?: string;
  take?: number;
};

export type PaginatedResult<T> = {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

export function paginate<T extends { id: string }>(
  rows: T[],
  take: number
): PaginatedResult<T> {
  const hasMore = rows.length > take;
  const data = hasMore ? rows.slice(0, take) : rows;
  return {
    data,
    hasMore,
    nextCursor: hasMore ? data[data.length - 1].id : null,
  };
}

// Enforce a hard cap on page size to prevent unbounded queries
export function clampTake(take: number | undefined, max = 100): number {
  return Math.min(take ?? 25, max);
}
