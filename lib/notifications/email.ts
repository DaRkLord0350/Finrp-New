// ============================================================
// Email notification service via Resend API
// ============================================================

import { inngest } from "@/inngest/client";
import { EVENTS, type EmailSendEventData } from "@/inngest/events";

interface EmailAttachment {
  /** File name shown to the recipient. */
  filename: string;
  /** Base64-encoded file content. */
  content: string;
}

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  attachments?: EmailAttachment[];
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const MAX_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Send a transactional email via Resend.
 *
 * - Env values are trimmed (a stray space in RESEND_FROM_EMAIL makes
 *   Resend reject the request), and the sender falls back to the
 *   verified production address.
 * - Transient failures (network errors, 429, 5xx) are retried with
 *   backoff. Permanent failures (4xx, e.g. an unverified domain) are
 *   surfaced immediately with Resend's real message — never swallowed.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.error("[email] RESEND_API_KEY not configured — cannot send email");
    return { success: false, error: "Email is not configured. Set RESEND_API_KEY to enable sending." };
  }

  const from = (opts.from ?? process.env.RESEND_FROM_EMAIL ?? "noreply@finrp.org").trim();
  const recipients = Array.isArray(opts.to) ? opts.to : [opts.to];

  const body: Record<string, unknown> = {
    from,
    to: recipients,
    subject: opts.subject,
    html: opts.html,
  };
  if (opts.cc?.length) body.cc = opts.cc;
  if (opts.bcc?.length) body.bcc = opts.bcc;
  if (opts.replyTo) body.reply_to = opts.replyTo;
  if (opts.attachments?.length) body.attachments = opts.attachments;

  let lastError = "Unknown error";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        if (attempt > 1) console.info(`[email] Sent to ${recipients.join(", ")} on attempt ${attempt}`);
        return { success: true };
      }

      lastError = (await res.text()) || `Resend responded ${res.status}`;
      const transient = res.status === 429 || res.status >= 500;
      console.error(
        `[email] Resend error (status ${res.status}, attempt ${attempt}/${MAX_ATTEMPTS}, from=${from}, to=${recipients.join(", ")}): ${lastError}`
      );
      // 4xx (bad sender / unverified domain / invalid recipient) won't fix on retry.
      if (!transient) return { success: false, error: lastError };
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Unknown network error";
      console.error(`[email] Send failed (attempt ${attempt}/${MAX_ATTEMPTS}): ${lastError}`);
    }

    if (attempt < MAX_ATTEMPTS) await sleep(attempt * 400);
  }

  return { success: false, error: lastError };
}

/**
 * Queue an email for durable, retried delivery through the email/send
 * Inngest function instead of sending inline. Use this for every
 * fire-and-forget email (invitations, onboarding, reminders, document
 * reviews, notifications). Returns immediately after the event is
 * accepted — delivery + retries happen in the background.
 *
 * Pass `dedupeKey` to collapse duplicate sends (e.g. one reminder per
 * task per day): it becomes the Inngest event id, deduped for 24h.
 */
export async function enqueueEmail(
  opts: EmailSendEventData & { dedupeKey?: string }
): Promise<void> {
  const { dedupeKey, ...data } = opts;
  await inngest.send({
    name: EVENTS.EMAIL_SEND,
    data,
    ...(dedupeKey ? { id: dedupeKey } : {}),
  });
}

export function buildInvoiceEmail(params: {
  customerName: string;
  businessName: string;
  invoiceNumber: string;
  amountDue: string;
  dueDate: string;
  message?: string;
  shareUrl?: string;
  accent?: string;
}): string {
  const accent = params.accent || "#6366f1";
  const intro = params.message?.trim()
    ? params.message.replace(/\n/g, "<br/>")
    : `Please find attached invoice <strong>${params.invoiceNumber}</strong> from ${params.businessName}.`;

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #111827;">
      <div style="border-bottom: 3px solid ${accent}; padding-bottom: 16px; margin-bottom: 20px;">
        <h1 style="margin: 0; font-size: 20px; color: #111827;">${params.businessName}</h1>
        <p style="margin: 4px 0 0; color: #6b7280; font-size: 13px;">Invoice ${params.invoiceNumber}</p>
      </div>
      <p style="color: #374151; font-size: 14px; line-height: 1.6;">Hi ${params.customerName},</p>
      <p style="color: #374151; font-size: 14px; line-height: 1.6;">${intro}</p>
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; margin: 20px 0;">
        <table style="width: 100%; font-size: 14px; color: #374151;">
          <tr><td style="padding: 4px 0; color: #6b7280;">Invoice</td><td style="text-align: right; font-weight: 600;">${params.invoiceNumber}</td></tr>
          <tr><td style="padding: 4px 0; color: #6b7280;">Amount Due</td><td style="text-align: right; font-weight: 700; color: ${accent};">${params.amountDue}</td></tr>
          <tr><td style="padding: 4px 0; color: #6b7280;">Due Date</td><td style="text-align: right; font-weight: 600;">${params.dueDate}</td></tr>
        </table>
      </div>
      ${
        params.shareUrl
          ? `<a href="${params.shareUrl}" style="display: inline-block; background: ${accent}; color: #fff; text-decoration: none; padding: 11px 22px; border-radius: 8px; font-size: 14px; font-weight: 600;">View Invoice Online</a>`
          : ""
      }
      <p style="color: #6b7280; font-size: 13px; margin-top: 20px;">A PDF copy of this invoice is attached for your records.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0 16px;" />
      <p style="color: #9ca3af; font-size: 12px;">${params.businessName} · Powered by FinRP</p>
    </div>
  `;
}

export function buildTaskDueEmail(params: {
  recipientName: string;
  taskTitle: string;
  customerName: string;
  dueDate: string;
  daysUntilDue: number;
}): string {
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1a1a1a; margin-bottom: 8px;">Task Due Reminder</h2>
      <p style="color: #555; margin-bottom: 24px;">Hi ${params.recipientName},</p>
      <div style="background: #f8f9fa; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 4px; margin-bottom: 20px;">
        <p style="margin: 0; font-weight: 600; color: #1a1a1a;">${params.taskTitle}</p>
        <p style="margin: 4px 0 0; color: #555; font-size: 14px;">Client: ${params.customerName}</p>
        <p style="margin: 4px 0 0; color: #f59e0b; font-size: 14px; font-weight: 600;">
          Due in ${params.daysUntilDue} day${params.daysUntilDue !== 1 ? "s" : ""}: ${params.dueDate}
        </p>
      </div>
      <p style="color: #555; font-size: 14px;">Please log in to FinRP to update the task status.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="color: #9ca3af; font-size: 12px;">FinRP — Practice Management Platform</p>
    </div>
  `;
}

export function buildAssignmentEmail(params: {
  caName: string;
  customerName: string;
  firmName: string;
}): string {
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1a1a1a; margin-bottom: 8px;">New Client Assigned</h2>
      <p style="color: #555; margin-bottom: 24px;">Hi ${params.caName},</p>
      <div style="background: #f8f9fa; border-left: 4px solid #10b981; padding: 16px; border-radius: 4px; margin-bottom: 20px;">
        <p style="margin: 0; font-weight: 600; color: #1a1a1a;">${params.customerName}</p>
        <p style="margin: 4px 0 0; color: #555; font-size: 14px;">has been assigned to you at ${params.firmName}.</p>
      </div>
      <p style="color: #555; font-size: 14px;">Log in to FinRP to view the client details and pending tasks.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="color: #9ca3af; font-size: 12px;">FinRP — Practice Management Platform</p>
    </div>
  `;
}

export function buildTeamInviteEmail(params: {
  name: string;
  firmName: string;
  inviterName: string;
  role: string;
  inviteUrl: string;
}): string {
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1a1a1a; margin-bottom: 8px;">You're invited to join ${params.firmName}</h2>
      <p style="color: #555; margin-bottom: 24px;">Hi ${params.name},</p>
      <div style="background: #f8f9fa; border-left: 4px solid #6366f1; padding: 16px; border-radius: 4px; margin-bottom: 20px;">
        <p style="margin: 0; color: #1a1a1a; font-size: 14px;">
          ${params.inviterName} has invited you to join <strong>${params.firmName}</strong> on FinRP as
          <strong>${params.role}</strong>.
        </p>
      </div>
      <p style="color: #555; font-size: 14px; margin-bottom: 20px;">
        Sign up with this email address to accept the invitation and access the practice workspace.
      </p>
      <a href="${params.inviteUrl}" style="display: inline-block; background: #6366f1; color: white; text-decoration: none; padding: 11px 22px; border-radius: 8px; font-size: 14px; font-weight: 600;">
        Accept Invitation
      </a>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0 16px;" />
      <p style="color: #9ca3af; font-size: 12px;">FinRP — Practice Management Platform</p>
    </div>
  `;
}

export function buildCustomerInviteEmail(params: {
  name: string;
  firmName: string;
  inviterName: string;
  inviteUrl: string;
  message?: string;
}): string {
  const note = params.message
    ? `<div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 14px 16px; border-radius: 4px; margin-bottom: 20px;">
         <p style="margin: 0; color: #78350f; font-size: 14px; line-height: 1.6;">${params.message}</p>
       </div>`
    : "";
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1a1a1a; margin-bottom: 8px;">${params.firmName} invited you to FinRP</h2>
      <p style="color: #555; margin-bottom: 24px;">Hi ${params.name},</p>
      <div style="background: #f8f9fa; border-left: 4px solid #6366f1; padding: 16px; border-radius: 4px; margin-bottom: 20px;">
        <p style="margin: 0; color: #1a1a1a; font-size: 14px; line-height: 1.6;">
          ${params.inviterName} from <strong>${params.firmName}</strong> has invited you to onboard onto
          <strong>FinRP</strong> — a secure workspace to manage your invoices, documents, banking and
          compliance together with your accountant.
        </p>
      </div>
      ${note}
      <p style="color: #555; font-size: 14px; margin-bottom: 20px;">
        Get started by creating your account with this email address. Your workspace is set up automatically.
      </p>
      <a href="${params.inviteUrl}" style="display: inline-block; background: #6366f1; color: white; text-decoration: none; padding: 11px 22px; border-radius: 8px; font-size: 14px; font-weight: 600;">
        Accept &amp; Set Up Account
      </a>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 18px;">
        If the button doesn't work, copy and paste this link into your browser:<br/>
        <span style="color: #6366f1; word-break: break-all;">${params.inviteUrl}</span>
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0 16px;" />
      <p style="color: #9ca3af; font-size: 12px;">FinRP — Practice Management Platform</p>
    </div>
  `;
}

export function buildInviteEmail(params: {
  inviteeName?: string;
  workspaceName: string;
  inviterName: string;
  roleLabel: string;
  inviteUrl: string;
}): string {
  const greeting = params.inviteeName ? `Hi ${params.inviteeName},` : "Hello,";
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #111827;">
      <h2 style="color: #111827; margin-bottom: 8px;">You've been invited to ${params.workspaceName}</h2>
      <p style="color: #555; margin-bottom: 20px;">${greeting}</p>
      <div style="background: #f8f9fa; border-left: 4px solid #6366f1; padding: 16px; border-radius: 6px; margin-bottom: 20px;">
        <p style="margin: 0; color: #111827; font-size: 14px; line-height: 1.6;">
          ${params.inviterName} has invited you to join <strong>${params.workspaceName}</strong> on FinRP as
          <strong>${params.roleLabel}</strong>.
        </p>
      </div>
      <p style="color: #555; font-size: 14px; margin-bottom: 20px;">
        Accept the invitation by creating your account with this email address — you'll get immediate access to the workspace.
      </p>
      <a href="${params.inviteUrl}" style="display: inline-block; background: #6366f1; color: #fff; text-decoration: none; padding: 11px 22px; border-radius: 8px; font-size: 14px; font-weight: 600;">
        Accept Invitation
      </a>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 18px;">
        If the button doesn't work, copy and paste this link into your browser:<br/>
        <span style="color: #6366f1; word-break: break-all;">${params.inviteUrl}</span>
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0 16px;" />
      <p style="color: #9ca3af; font-size: 12px;">${params.workspaceName} · Powered by FinRP</p>
    </div>
  `;
}

export function buildDocumentReviewEmail(params: {
  recipientName: string;
  documentName: string;
  status: "APPROVED" | "REJECTED";
  comment?: string;
}): string {
  const isApproved = params.status === "APPROVED";
  const color = isApproved ? "#10b981" : "#ef4444";
  const label = isApproved ? "Approved" : "Rejected";

  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1a1a1a; margin-bottom: 8px;">Document ${label}</h2>
      <p style="color: #555; margin-bottom: 24px;">Hi ${params.recipientName},</p>
      <div style="background: #f8f9fa; border-left: 4px solid ${color}; padding: 16px; border-radius: 4px; margin-bottom: 20px;">
        <p style="margin: 0; font-weight: 600; color: #1a1a1a;">${params.documentName}</p>
        <p style="margin: 4px 0 0; color: ${color}; font-size: 14px; font-weight: 600;">Status: ${label}</p>
        ${params.comment ? `<p style="margin: 8px 0 0; color: #555; font-size: 14px;">${params.comment}</p>` : ""}
      </div>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="color: #9ca3af; font-size: 12px;">FinRP — Practice Management Platform</p>
    </div>
  `;
}
