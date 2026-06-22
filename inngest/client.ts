// ============================================================
// FinRP — Inngest Client (SDK v4)
//
// The single Inngest client for the whole app. Producers import
// `inngest` from here to send events; consumers (inngest/functions/*)
// use `inngest.createFunction(...)`.
//
// Event payloads are typed at the producer boundary by the enqueue*
// helpers (lib/jobs, lib/banking, lib/tax, notifications, …) and cast
// to those same interfaces inside each function — see inngest/events.ts
// for the catalog. Secrets are never hardcoded: in production the SDK
// reads INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY from the environment;
// the local Dev Server (http://localhost:8288) needs neither.
// ============================================================

import { Inngest } from "inngest";

// Event names + payload shapes are catalogued in events.ts (the `EVENTS`
// constants and `Events` type): producers send `{ name: EVENTS.X, data }` with
// `data` typed to the matching interface, and each function casts `event.data`
// to that same interface — one definition per payload, enforced by convention.
// Event/signing keys are read from the environment by the SDK in production
// (INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY); the local Dev Server needs neither
// when INNGEST_DEV=1. Never hardcode secrets here.
export const inngest = new Inngest({ id: "finrp" });

export type FinRPInngest = typeof inngest;
