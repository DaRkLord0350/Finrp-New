// ============================================================
// Unified notification dispatcher
// Queues to DB and attempts immediate send
// ============================================================

import { prisma } from "@/lib/prisma";
import { enqueueEmail, buildTaskDueEmail, buildAssignmentEmail, buildDocumentReviewEmail, buildTeamInviteEmail, buildCustomerInviteEmail } from "./email";
import { sendWhatsApp, buildTaskDueWhatsApp, buildAssignmentWhatsApp } from "./whatsapp";

interface NotifyTaskDueParams {
  organizationId: string;
  recipientEmail: string;
  recipientPhone?: string;
  recipientName: string;
  taskTitle: string;
  customerName: string;
  dueDate: string;
  daysUntilDue: number;
}

interface NotifyAssignmentParams {
  organizationId: string;
  caEmail: string;
  caPhone?: string;
  caName: string;
  customerName: string;
  firmName: string;
}

interface NotifyDocumentReviewParams {
  organizationId: string;
  recipientEmail: string;
  recipientName: string;
  documentName: string;
  status: "APPROVED" | "REJECTED";
  comment?: string;
}

async function getSettings(organizationId: string) {
  return prisma.firmNotificationSettings.findUnique({
    where: { organizationId },
  });
}

async function queueNotification(params: {
  organizationId: string;
  recipientEmail?: string;
  recipientPhone?: string;
  channel: "EMAIL" | "WHATSAPP" | "IN_APP";
  subject?: string;
  body: string;
  metadata?: Record<string, string | number | boolean | null>;
}) {
  await prisma.notificationQueue.create({
    data: {
      organizationId: params.organizationId,
      recipientEmail: params.recipientEmail,
      recipientPhone: params.recipientPhone,
      channel: params.channel,
      subject: params.subject,
      body: params.body,
      metadata: params.metadata,
    },
  }).catch((err) => console.error("[notify] Queue failed:", err));
}

export async function notifyTaskDue(params: NotifyTaskDueParams) {
  const settings = await getSettings(params.organizationId);

  if (settings?.emailEnabled) {
    const html = buildTaskDueEmail(params);
    await queueNotification({
      organizationId: params.organizationId,
      recipientEmail: params.recipientEmail,
      channel: "EMAIL",
      subject: `Task Due Reminder: ${params.taskTitle}`,
      body: html,
    });
    await enqueueEmail({
      to: params.recipientEmail,
      subject: `Task Due Reminder: ${params.taskTitle}`,
      html,
      kind: "task-due",
      organizationId: params.organizationId,
    }).catch(() => {});
  }

  if (settings?.whatsappEnabled && params.recipientPhone) {
    const body = buildTaskDueWhatsApp(params);
    await queueNotification({
      organizationId: params.organizationId,
      recipientPhone: params.recipientPhone,
      channel: "WHATSAPP",
      body,
    });
    sendWhatsApp({ to: params.recipientPhone, body }).catch(() => {});
  }
}

export async function notifyAssignment(params: NotifyAssignmentParams) {
  const settings = await getSettings(params.organizationId);

  if (settings?.emailEnabled && settings?.notifyAssignment) {
    const html = buildAssignmentEmail({ caName: params.caName, customerName: params.customerName, firmName: params.firmName });
    await queueNotification({
      organizationId: params.organizationId,
      recipientEmail: params.caEmail,
      channel: "EMAIL",
      subject: `New Client Assigned: ${params.customerName}`,
      body: html,
    });
    await enqueueEmail({
      to: params.caEmail,
      subject: `New Client Assigned: ${params.customerName}`,
      html,
      kind: "assignment",
      organizationId: params.organizationId,
    }).catch(() => {});
  }

  if (settings?.whatsappEnabled && settings?.notifyAssignment && params.caPhone) {
    const body = buildAssignmentWhatsApp({ customerName: params.customerName, firmName: params.firmName });
    sendWhatsApp({ to: params.caPhone, body }).catch(() => {});
  }
}

interface NotifyTeamInviteParams {
  organizationId: string;
  recipientEmail: string;
  recipientName: string;
  firmName: string;
  inviterName: string;
  role: string;
  inviteUrl: string;
}

export async function notifyTeamInvite(params: NotifyTeamInviteParams) {
  const settings = await getSettings(params.organizationId);
  // Team invites are transactional — send unless email is explicitly disabled.
  if (settings?.emailEnabled === false) return;

  const html = buildTeamInviteEmail({
    name: params.recipientName,
    firmName: params.firmName,
    inviterName: params.inviterName,
    role: params.role,
    inviteUrl: params.inviteUrl,
  });
  const subject = `You've been invited to join ${params.firmName} on FinRP`;

  await queueNotification({
    organizationId: params.organizationId,
    recipientEmail: params.recipientEmail,
    channel: "EMAIL",
    subject,
    body: html,
  });
  await enqueueEmail({
    to: params.recipientEmail,
    subject,
    html,
    kind: "team-invite",
    organizationId: params.organizationId,
  }).catch(() => {});
}

interface NotifyCustomerInviteParams {
  organizationId: string;
  recipientEmail: string;
  recipientName: string;
  firmName: string;
  inviterName: string;
  inviteUrl: string;
  message?: string;
}

export async function notifyCustomerInvite(params: NotifyCustomerInviteParams) {
  const settings = await getSettings(params.organizationId);
  // Onboarding invites are transactional — send unless email is explicitly disabled.
  if (settings?.emailEnabled === false) return;

  const html = buildCustomerInviteEmail({
    name: params.recipientName,
    firmName: params.firmName,
    inviterName: params.inviterName,
    inviteUrl: params.inviteUrl,
    message: params.message,
  });
  const subject = `${params.firmName} invited you to onboard onto FinRP`;

  await queueNotification({
    organizationId: params.organizationId,
    recipientEmail: params.recipientEmail,
    channel: "EMAIL",
    subject,
    body: html,
  });
  await enqueueEmail({
    to: params.recipientEmail,
    subject,
    html,
    kind: "customer-invite",
    organizationId: params.organizationId,
  }).catch(() => {});
}

export async function notifyDocumentReview(params: NotifyDocumentReviewParams) {
  const settings = await getSettings(params.organizationId);
  const shouldNotify = params.status === "APPROVED" ? settings?.notifyDocApproved : settings?.notifyDocRejected;

  if (settings?.emailEnabled && shouldNotify !== false) {
    const html = buildDocumentReviewEmail(params);
    await queueNotification({
      organizationId: params.organizationId,
      recipientEmail: params.recipientEmail,
      channel: "EMAIL",
      subject: `Document ${params.status === "APPROVED" ? "Approved" : "Rejected"}: ${params.documentName}`,
      body: html,
    });
    await enqueueEmail({
      to: params.recipientEmail,
      subject: `Document ${params.status === "APPROVED" ? "Approved" : "Rejected"}: ${params.documentName}`,
      html,
      kind: "document-review",
      organizationId: params.organizationId,
    }).catch(() => {});
  }
}
