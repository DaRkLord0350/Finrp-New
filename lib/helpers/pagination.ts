// export function getPagination(page = 1, limit = 10) {
//   const skip = (page - 1) * limit;

//   return {
//     skip,
//     take: limit,
//   };
// }

// ============================================================
// lib/helpers/pagination.ts
// Server-side pagination helpers for Prisma queries.
// ============================================================

export interface PaginationParams {
  page?: number | string | null;
  pageSize?: number | string | null;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function parsePagination(
  params: PaginationParams,
  defaultPageSize = 25
): { page: number; pageSize: number; skip: number; take: number } {
  const page = Math.max(1, parseInt(String(params.page ?? "1"), 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(String(params.pageSize ?? defaultPageSize), 10) || defaultPageSize)
  );
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function buildPaginationMeta(
  page: number,
  pageSize: number,
  total: number
): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

export function paginatedResponse<T>(
  data: T[],
  meta: PaginationMeta
): { data: T[]; meta: PaginationMeta } {
  return { data, meta };
}
