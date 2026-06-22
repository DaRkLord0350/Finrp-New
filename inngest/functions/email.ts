// ============================================================
// Inngest function — Transactional email delivery
// Replaces every fire-and-forget / synchronous email path. Wraps the
// existing Resend-backed sendEmail() in a memoized step so a function
// retry never re-sends an email that already went out (duplicate-send
// protection). Inngest provides the durable retry budget on top of
// sendEmail's own per-request transient retries.
// ============================================================

import { inngest } from "@/inngest/client";
import { EVENTS, type EmailSendEventData } from "@/inngest/events";
import { sendEmail } from "@/lib/notifications/email";
import { startBackgroundJob } from "@/lib/jobs/background-job";

export const emailSend = inngest.createFunction(
  {
    id: "email-send",
    name: "Send Email",
    concurrency: 20,
    retries: 3,
    triggers: [{ event: EVENTS.EMAIL_SEND }],
  },
  async ({ event, step, runId, attempt }) => {
    const data = event.data as EmailSendEventData;
    const recipients = Array.isArray(data.to) ? data.to.join(", ") : data.to;

    const bg = await startBackgroundJob({
      type: "email.send",
      organizationId: data.organizationId ?? null,
      idempotencyKey: event.id ? `email.send:${event.id}` : null,
      eventName: event.name,
      eventId: event.id,
      runId,
      attempt: attempt + 1,
      metadata: { kind: data.kind ?? "generic", to: recipients, subject: data.subject },
    });

    const result = await step.run("send", () =>
      sendEmail({
        to: data.to,
        subject: data.subject,
        html: data.html,
        from: data.from,
        cc: data.cc,
        bcc: data.bcc,
        replyTo: data.replyTo,
        attachments: data.attachments,
      })
    );

    if (!result.success) {
      await bg.fail(result.error ?? "Email send failed");
      // Throw so Inngest retries transient outages; permanent failures
      // (e.g. unverified domain) settle as FAILED after the retry budget.
      throw new Error(`Email delivery failed: ${result.error ?? "unknown error"}`);
    }

    await bg.complete({ to: recipients, subject: data.subject });
    return { delivered: true };
  }
);
