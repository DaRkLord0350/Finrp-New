// ============================================================
// Email notification service via Resend API
// ============================================================

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not configured — email skipped");
    return { success: false, error: "Email not configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: opts.from ?? process.env.RESEND_FROM_EMAIL ?? "noreply@finrp.in",
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[email] Resend error:", err);
      return { success: false, error: err };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[email] Send failed:", msg);
    return { success: false, error: msg };
  }
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
