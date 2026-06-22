// ============================================================
// Inngest serve handler — GET/POST/PUT /api/inngest
//
// The Inngest Dev Server (http://localhost:8288) and Inngest Cloud
// discover and invoke every registered function through this endpoint.
// Signing/event keys are read from env (INNGEST_SIGNING_KEY /
// INNGEST_EVENT_KEY) by the SDK — never hardcoded here.
// ============================================================

import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { functions } from "@/inngest";

// Functions parse files / render PDFs / hit the DB — needs the Node runtime.
export const runtime = "nodejs";
// Never cache the serve handshake or invocations.
export const dynamic = "force-dynamic";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
