// ============================================================
// WhatsApp notification service via Twilio WhatsApp API
// ============================================================

interface SendWhatsAppOptions {
  to: string; // E.164 format e.g. +919999999999
  body: string;
  from?: string;
}

export async function sendWhatsApp(opts: SendWhatsAppOptions): Promise<{ success: boolean; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = opts.from ?? process.env.TWILIO_WHATSAPP_FROM ?? "whatsapp:+14155238886";

  if (!accountSid || !authToken) {
    console.warn("[whatsapp] Twilio credentials not configured — WhatsApp skipped");
    return { success: false, error: "WhatsApp not configured" };
  }

  const toNumber = opts.to.startsWith("whatsapp:") ? opts.to : `whatsapp:${opts.to}`;

  try {
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const body = new URLSearchParams({
      From: from,
      To: toNumber,
      Body: opts.body,
    });

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("[whatsapp] Twilio error:", err);
      return { success: false, error: err };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[whatsapp] Send failed:", msg);
    return { success: false, error: msg };
  }
}

export function buildTaskDueWhatsApp(params: {
  taskTitle: string;
  customerName: string;
  dueDate: string;
  daysUntilDue: number;
}): string {
  return `*FinRP Task Reminder*\n\n📋 *${params.taskTitle}*\n👤 Client: ${params.customerName}\n⏰ Due in ${params.daysUntilDue} day${params.daysUntilDue !== 1 ? "s" : ""}: ${params.dueDate}\n\nLog in to FinRP to update the task status.`;
}

export function buildAssignmentWhatsApp(params: {
  customerName: string;
  firmName: string;
}): string {
  return `*FinRP — New Client Assigned*\n\n✅ *${params.customerName}* has been assigned to you at ${params.firmName}.\n\nLog in to FinRP to view client details.`;
}
