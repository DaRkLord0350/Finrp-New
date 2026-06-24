// ============================================================
// Unified notification dispatcher
// Queues to DB and attempts immediate send
// ============================================================

import { prisma } from "@/lib/prisma";
import { enqueueEmail, sendEmail, buildTaskDueEmail, buildAssignmentEmail, buildDocumentReviewEmail, buildTeamInviteEmail, buildCustomerInviteEmail } from "./email";
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

export type InviteSendResult = { success: boolean; id?: string; error?: string };

export async function notifyTeamInvite(params: NotifyTeamInviteParams): Promise<InviteSendResult> {
  const settings = await getSettings(params.organizationId);
  // Team invites are transactional — send unless email is explicitly disabled.
  if (settings?.emailEnabled === false) {
    console.warn("[INVITE] Email disabled for org — skipping team invite send", {
      organizationId: params.organizationId,
      email: params.recipientEmail,
    });
    return { success: false, error: "Email notifications are disabled for this firm" };
  }

  const html = buildTeamInviteEmail({
    name: params.recipientName,
    firmName: params.firmName,
    inviterName: params.inviterName,
    role: params.role,
    inviteUrl: params.inviteUrl,
  });
  const subject = `You've been invited to join ${params.firmName} on FinRP`;

  // Keep the in-app/DB notification record (best-effort).
  await queueNotification({
    organizationId: params.organizationId,
    recipientEmail: params.recipientEmail,
    channel: "EMAIL",
    subject,
    body: html,
  });

  // Send the invitation email DIRECTLY via Resend (transactional — must
  // complete within the request, not be queued to a background worker
  // that may never run). Errors are surfaced, never swallowed.
  console.log("[INVITE] Sending team invite email", {
    email: params.recipientEmail,
    organizationId: params.organizationId,
    inviteUrl: params.inviteUrl,
  });
  const result = await sendEmail({
    to: params.recipientEmail,
    subject,
    html,
  });
  if (result.success) {
    console.log("[INVITE] Team invite email sent", { email: params.recipientEmail, messageId: result.id });
  } else {
    console.error("[INVITE] Team invite email FAILED", { email: params.recipientEmail, error: result.error });
  }
  return result;
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

export async function notifyCustomerInvite(params: NotifyCustomerInviteParams): Promise<InviteSendResult> {
  const settings = await getSettings(params.organizationId);
  // Onboarding invites are transactional — send unless email is explicitly disabled.
  if (settings?.emailEnabled === false) {
    console.warn("[INVITE] Email disabled for org — skipping customer invite send", {
      organizationId: params.organizationId,
      email: params.recipientEmail,
    });
    return { success: false, error: "Email notifications are disabled for this firm" };
  }

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

  // Send directly via Resend (transactional). See notifyTeamInvite.
  console.log("[INVITE] Sending customer invite email", {
    email: params.recipientEmail,
    organizationId: params.organizationId,
    inviteUrl: params.inviteUrl,
  });
  const result = await sendEmail({
    to: params.recipientEmail,
    subject,
    html,
  });
  if (result.success) {
    console.log("[INVITE] Customer invite email sent", { email: params.recipientEmail, messageId: result.id });
  } else {
    console.error("[INVITE] Customer invite email FAILED", { email: params.recipientEmail, error: result.error });
  }
  return result;
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
