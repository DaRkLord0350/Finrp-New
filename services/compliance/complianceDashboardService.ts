import { prisma } from "@/lib/prisma";
import type { ComplianceDashboardData, ComplianceMonthlyTrend } from "@/types/compliance";

export const complianceDashboardService = {
  async getDashboard(organizationId: string): Promise<ComplianceDashboardData> {
    const now = new Date();
    const thirtyDaysOut = new Date(now);
    thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);

    // All queries run in parallel — including the overdueFiling count and
    // category lookup that were previously sequential after the Promise.all.
    const [
      statusCounts,
      categoryDistribution,
      recentSubmissions,
      upcomingDeadlines,
      pendingReminders,
      expiringItems,
      monthlyRaw,
      overdueFilingCount,
      allCategories,
    ] = await Promise.all([
      prisma.complianceSubmission.groupBy({
        by: ["status"],
        where: { organizationId, deletedAt: null },
        _count: true,
      }),

      prisma.complianceSubmission.groupBy({
        by: ["categoryId"],
        where: { organizationId, deletedAt: null },
        _count: true,
      }),

      prisma.complianceSubmission.findMany({
        where: { organizationId, deletedAt: null },
        select: {
          id: true,
          organizationId: true,
          categoryId: true,
          typeId: true,
          title: true,
          description: true,
          referenceNumber: true,
          status: true,
          submissionDate: true,
          effectiveDate: true,
          expiryDate: true,
          dueDate: true,
          renewalDate: true,
          penaltyAmount: true,
          feeAmount: true,
          assignedToId: true,
          reviewedById: true,
          version: true,
          tags: true,
          notes: true,
          createdBy: true,
          updatedBy: true,
          deletedAt: true,
          createdAt: true,
          updatedAt: true,
          category: { select: { id: true, name: true, code: true, color: true, icon: true } },
          type: { select: { id: true, name: true, code: true } },
          _count: { select: { documents: true, approvals: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),

      prisma.complianceDeadline.findMany({
        where: {
          organizationId,
          isCompleted: false,
          deadlineDate: { gte: now, lte: thirtyDaysOut },
        },
        orderBy: { deadlineDate: "asc" },
        take: 10,
      }),

      prisma.complianceReminder.findMany({
        where: {
          organizationId,
          isActive: true,
          isTriggered: false,
          reminderDate: { lte: thirtyDaysOut },
        },
        orderBy: { reminderDate: "asc" },
        take: 10,
        include: {
          submission: { select: { id: true, title: true, status: true } },
        },
      }),

      prisma.complianceSubmission.findMany({
        where: {
          organizationId,
          deletedAt: null,
          status: { in: ["APPROVED", "SUBMITTED"] },
          expiryDate: { gte: now, lte: thirtyDaysOut },
        },
        select: {
          id: true,
          organizationId: true,
          categoryId: true,
          typeId: true,
          title: true,
          description: true,
          referenceNumber: true,
          status: true,
          submissionDate: true,
          effectiveDate: true,
          expiryDate: true,
          dueDate: true,
          renewalDate: true,
          penaltyAmount: true,
          feeAmount: true,
          assignedToId: true,
          reviewedById: true,
          version: true,
          tags: true,
          notes: true,
          createdBy: true,
          updatedBy: true,
          deletedAt: true,
          createdAt: true,
          updatedAt: true,
          category: { select: { id: true, name: true, code: true, color: true, icon: true } },
          type: { select: { id: true, name: true, code: true } },
          _count: { select: { documents: true, approvals: true } },
        },
        orderBy: { expiryDate: "asc" },
        take: 10,
      }),

      prisma.$queryRaw<{ month: string; status: string; count: bigint }[]>`
        SELECT
          TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') AS month,
          status::text,
          COUNT(*) AS count
        FROM compliance_submissions
        WHERE "organizationId" = ${organizationId}
          AND "deletedAt" IS NULL
          AND "createdAt" >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', "createdAt"), status
        ORDER BY DATE_TRUNC('month', "createdAt") ASC
      `,

      // Previously sequential — now parallel
      prisma.complianceSubmission.count({
        where: {
          organizationId,
          deletedAt: null,
          status: { in: ["DRAFT", "SUBMITTED", "UNDER_REVIEW"] },
          dueDate: { lt: now },
        },
      }),

      // Previously sequential — now parallel
      prisma.complianceCategory.findMany({
        where: { organizationId },
        select: { id: true, name: true, code: true, color: true },
      }),
    ]);

    const countByStatus = Object.fromEntries(
      statusCounts.map((r) => [r.status, r._count])
    );

    const stats = {
      totalSubmissions: Object.values(countByStatus).reduce((a, b) => a + b, 0),
      pendingApprovals: (countByStatus["SUBMITTED"] ?? 0) + (countByStatus["UNDER_REVIEW"] ?? 0),
      expiringSoon: expiringItems.length,
      overdueFiling: overdueFilingCount,
      rejectedItems: countByStatus["REJECTED"] ?? 0,
      approvedItems: countByStatus["APPROVED"] ?? 0,
      draftItems: countByStatus["DRAFT"] ?? 0,
      submittedItems: countByStatus["SUBMITTED"] ?? 0,
    };

    // Build monthly trend
    const monthlyMap = new Map<string, ComplianceMonthlyTrend>();
    for (const row of monthlyRaw) {
      if (!monthlyMap.has(row.month)) {
        monthlyMap.set(row.month, { month: row.month, submitted: 0, approved: 0, rejected: 0, expired: 0 });
      }
      const entry = monthlyMap.get(row.month)!;
      const count = Number(row.count);
      if (row.status === "SUBMITTED" || row.status === "UNDER_REVIEW") entry.submitted += count;
      else if (row.status === "APPROVED") entry.approved += count;
      else if (row.status === "REJECTED") entry.rejected += count;
      else if (row.status === "EXPIRED") entry.expired += count;
    }
    const monthlyTrend = Array.from(monthlyMap.values());

    const catMap = new Map(allCategories.map((c) => [c.id, c]));

    const categoryDist = categoryDistribution.map((r) => {
      const cat = catMap.get(r.categoryId);
      return {
        categoryName: cat?.name ?? "Unknown",
        code: cat?.code ?? "",
        count: r._count,
        color: cat?.color ?? "#6366f1",
      };
    });

    return {
      stats,
      monthlyTrend,
      categoryDistribution: categoryDist,
      recentSubmissions: recentSubmissions as never,
      upcomingDeadlines: upcomingDeadlines as never,
      pendingReminders: pendingReminders as never,
      expiringItems: expiringItems as never,
    };
  },
};
