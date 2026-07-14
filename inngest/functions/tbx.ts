// ============================================================
// Inngest function — TBX verification dispatch.
// Runs any lib/tbx/service.ts call asynchronously (wizard submit,
// bank re-verification, etc.) so the caller doesn't block on TBX's
// network round-trip. Advances the BackgroundJob ledger. Inngest
// owns retries (3) on top of the provider's own internal retry.
//
// Domain write-back (updating BusinessProfile/OrganizationRelated
// Party/OrgBankAccountVerification/KycProfile with the verification
// result) is added by each module's own task as those tables land —
// this function's job is dispatch + logging + ledger, not persistence
// of verification results into domain tables.
// ============================================================

import { inngest } from "@/inngest/client";
import { EVENTS } from "@/inngest/events";
import { startBackgroundJob } from "@/lib/jobs/background-job";
import * as tbxService from "@/lib/tbx/service";
import type { TbxJobData, TbxJobName } from "@/lib/tbx/queue";
import type {
  CreateTbxCustomerInput,
  FetchCkycInput,
  FetchDirectorInput,
  ScreenAmlPepInput,
  VerifyAadhaarInput,
  VerifyBankAccountInput,
  VerifyCinInput,
  VerifyGstinInput,
  VerifyPanInput,
} from "@/lib/tbx/types";

async function dispatch(data: TbxJobData): Promise<Record<string, unknown>> {
  const opts = {
    organizationId: data.organizationId,
    userId: data.userId,
    subjectType: data.subjectType,
    subjectId: data.subjectId,
  };

  switch (data.jobName) {
    case "verifyPan":
      return { ...(await tbxService.verifyPan(data.payload as unknown as VerifyPanInput, opts)) };
    case "verifyGstin":
      return { ...(await tbxService.verifyGstin(data.payload as unknown as VerifyGstinInput, opts)) };
    case "verifyCin":
      return { ...(await tbxService.verifyCin(data.payload as unknown as VerifyCinInput, opts)) };
    case "verifyAadhaar":
      return { ...(await tbxService.verifyAadhaar(data.payload as unknown as VerifyAadhaarInput, opts)) };
    case "verifyBankAccount":
      return { ...(await tbxService.verifyBankAccount(data.payload as unknown as VerifyBankAccountInput, opts)) };
    case "fetchDirector":
      return { ...(await tbxService.fetchDirector(data.payload as unknown as FetchDirectorInput, opts)) };
    case "fetchCkyc":
      return { ...(await tbxService.fetchCkyc(data.payload as unknown as FetchCkycInput, opts)) };
    case "screenAmlPep":
      return { ...(await tbxService.screenAmlPep(data.payload as unknown as ScreenAmlPepInput, opts)) };
    case "createCustomer":
      return { ...(await tbxService.createTbxCustomer(data.payload as unknown as CreateTbxCustomerInput, opts)) };
    default: {
      const _exhaustive: never = data.jobName;
      throw new Error(`Unknown TBX job: ${_exhaustive as TbxJobName}`);
    }
  }
}

export const tbxVerification = inngest.createFunction(
  {
    id: "tbx-verification",
    name: "TBX Verification",
    concurrency: 5,
    retries: 3,
    triggers: [{ event: EVENTS.TBX_VERIFICATION_REQUESTED }],
  },
  async ({ event, step, runId, attempt }) => {
    const data = event.data as TbxJobData;

    const bg = await startBackgroundJob({
      type: `tbx.${data.jobName}`,
      organizationId: data.organizationId,
      referenceId: data.subjectId ?? null,
      idempotencyKey: event.id ? `tbx:${event.id}` : undefined,
      eventName: event.name,
      eventId: event.id,
      runId,
      attempt: attempt + 1,
      metadata: { jobName: data.jobName, subjectType: data.subjectType },
    });

    try {
      const result = await step.run("dispatch", () => dispatch(data));
      await bg.complete(result);
      return result;
    } catch (err) {
      await bg.fail(err);
      throw err;
    }
  }
);
