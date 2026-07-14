// ============================================================
// lib/repositories/tbx-log.repository.ts
// Tenant-scoped reads/writes for TbxApiLog (Module 8 audit log).
// Writes always go through lib/tbx/logging.ts, which redacts
// payloads first — this repository never redacts on its own.
// ============================================================

import { prisma } from "./base.repository";
import type { Prisma } from "@prisma/client";

export interface CreateTbxApiLogInput {
  organizationId?: string | null;
  userId?: string | null;
  apiName: string;
  endpoint?: string | null;
  httpMethod?: string | null;
  requestPayload?: Prisma.InputJsonValue;
  responsePayload?: Prisma.InputJsonValue;
  responseHeaders?: Prisma.InputJsonValue;
  statusCode?: number | null;
  durationMs?: number | null;
  retryCount?: number;
  success: boolean;
  errorMessage?: string | null;
  subjectType?: string | null;
  subjectId?: string | null;
  backgroundJobId?: string | null;
}

export interface ListTbxApiLogsQuery {
  organizationId?: string;
  apiName?: string;
  success?: boolean;
  page?: number;
  pageSize?: number;
}

export const tbxLogRepository = {
  async create(input: CreateTbxApiLogInput) {
    return prisma.tbxApiLog.create({
      data: {
        organizationId: input.organizationId ?? null,
        userId: input.userId ?? null,
        apiName: input.apiName,
        endpoint: input.endpoint ?? null,
        httpMethod: input.httpMethod ?? null,
        requestPayload: input.requestPayload,
        responsePayload: input.responsePayload,
        responseHeaders: input.responseHeaders,
        statusCode: input.statusCode ?? null,
        durationMs: input.durationMs ?? null,
        retryCount: input.retryCount ?? 0,
        success: input.success,
        errorMessage: input.errorMessage ?? null,
        subjectType: input.subjectType ?? null,
        subjectId: input.subjectId ?? null,
        backgroundJobId: input.backgroundJobId ?? null,
      },
      select: { id: true },
    });
  },

  async list(query: ListTbxApiLogsQuery) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 25, 100);
    const where: Prisma.TbxApiLogWhereInput = {
      ...(query.organizationId && { organizationId: query.organizationId }),
      ...(query.apiName && { apiName: query.apiName }),
      ...(query.success !== undefined && { success: query.success }),
    };

    const [data, total] = await Promise.all([
      prisma.tbxApiLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.tbxApiLog.count({ where }),
    ]);

    return { data, total, page, pageSize };
  },

  async findBySubject(subjectType: string, subjectId: string) {
    return prisma.tbxApiLog.findMany({
      where: { subjectType, subjectId },
      orderBy: { createdAt: "desc" },
    });
  },
};
