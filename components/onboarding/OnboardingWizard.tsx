"use client";

// ============================================================
// FinRP — OnboardingWizard
// 8-step client-side wizard. Server actions are called on each
// step completion; state is accumulated locally.
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StepLayout } from "./StepLayout";
import { WelcomeStep } from "./steps/WelcomeStep";
import { OrganizationStep } from "./steps/OrganizationStep";
import { ModuleSelectionStep } from "./steps/ModuleSelectionStep";
import { InviteTeamStep } from "./steps/InviteTeamStep";
import { DataImportStep } from "./steps/DataImportStep";
import { DemoDataStep } from "./steps/DemoDataStep";
import { PreferencesStep } from "./steps/PreferencesStep";
import { FinishStep } from "./steps/FinishStep";

import {
  actionSaveOrganizationDetails,
  actionSaveModuleSelection,
  actionSendInvitation,
  actionSaveImportChoice,
  actionSeedDemoData,
  actionSavePreferences,
  actionCompleteOnboarding,
} from "@/actions/onboarding";

import {
  ONBOARDING_STEPS,
  DEFAULT_ONBOARDING_STATE,
  type OnboardingState,
  type OnboardingModule,
  type OnboardingInvite,
  type DataImportOption,
  type DemoSeedResult,
} from "@/types/onboarding";
import type { OrganizationDetailsInput, PreferencesInput } from "@/validators/onboarding";

// ---------------------------------------------------------------------------
// Wizard — manages step state + calls server actions
// ---------------------------------------------------------------------------
export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [state, setState] = useState<OnboardingState>(DEFAULT_ONBOARDING_STATE);

  const totalSteps = ONBOARDING_STEPS.length;

  function mergeState(patch: Partial<OnboardingState>) {
    setState((prev) => ({ ...prev, ...patch }));
  }

  // ── Step 1: Welcome ───────────────────────────────────────────────────────
  function handleWelcomeNext() {
    setStep(2);
  }

  // ── Step 2: Organization Details ──────────────────────────────────────────
  async function handleOrgDetailsNext(data: OrganizationDetailsInput) {
    setIsLoading(true);
    try {
      const result = await actionSaveOrganizationDetails(data);
      if (!result.success) throw new Error(result.error);
      mergeState({
        orgName: data.orgName,
        businessType: data.businessType,
        gstNumber: data.gstNumber ?? "",
        currency: data.currency,
        timezone: data.timezone,
        logoUrl: data.logoUrl ?? "",
        address: data.address ?? "",
      });
      setStep(3);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  // ── Step 3: Module Selection ──────────────────────────────────────────────
  async function handleModulesNext(modules: OnboardingModule[]) {
    setIsLoading(true);
    try {
      const result = await actionSaveModuleSelection(modules);
      if (!result.success) throw new Error(result.error);
      mergeState({ enabledModules: modules });
      setStep(4);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  // ── Step 4: Invite Team ───────────────────────────────────────────────────
  async function handleInvitesNext(invites: OnboardingInvite[]) {
    setIsLoading(true);
    try {
      // Fire invitations; failures don't block progression
      await Promise.allSettled(
        invites.map((inv) => actionSendInvitation(inv.email, inv.role))
      );
      mergeState({ invites });
      setStep(5);
    } finally {
      setIsLoading(false);
    }
  }

  // ── Step 5: Data Import ───────────────────────────────────────────────────
  async function handleImportNext(option: DataImportOption) {
    setIsLoading(true);
    try {
      await actionSaveImportChoice(option);
      mergeState({ importOption: option });
      // Skip demo seeder step if not DEMO
      setStep(option === "DEMO" ? 6 : 7);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  // ── Step 6: Demo Data ─────────────────────────────────────────────────────
  async function handleDemoSeed(): Promise<DemoSeedResult> {
    return actionSeedDemoData();
  }

  function handleDemoNext() {
    setStep(7);
  }

  // ── Step 7: Preferences ───────────────────────────────────────────────────
  async function handlePreferencesNext(data: PreferencesInput) {
    setIsLoading(true);
    try {
      const result = await actionSavePreferences(data);
      if (!result.success) throw new Error(result.error);
      mergeState({
        theme: data.theme,
        emailNotifications: data.emailNotifications,
        smsNotifications: data.smsNotifications,
        dashboardLayout: data.dashboardLayout,
      });
      setStep(8);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  // ── Step 8: Finish ────────────────────────────────────────────────────────
  async function handleComplete() {
    setIsLoading(true);
    try {
      await actionCompleteOnboarding();
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      console.error(err);
      setIsLoading(false);
    }
  }

  // ── Current step metadata ─────────────────────────────────────────────────
  const currentMeta = ONBOARDING_STEPS.find((s) => s.id === step) ?? ONBOARDING_STEPS[0];

  return (
    <StepLayout
      currentStep={step}
      totalSteps={totalSteps}
      title={currentMeta.title}
      subtitle={currentMeta.subtitle}
    >
      {step === 1 && <WelcomeStep onNext={handleWelcomeNext} />}

      {step === 2 && (
        <OrganizationStep
          initialValues={{
            orgName: state.orgName,
            businessType: state.businessType,
            gstNumber: state.gstNumber,
            currency: state.currency,
            timezone: state.timezone,
            logoUrl: state.logoUrl,
            address: state.address,
          }}
          onNext={handleOrgDetailsNext}
          onBack={() => setStep(1)}
          isLoading={isLoading}
        />
      )}

      {step === 3 && (
        <ModuleSelectionStep
          initialModules={state.enabledModules}
          onNext={handleModulesNext}
          onBack={() => setStep(2)}
          isLoading={isLoading}
        />
      )}

      {step === 4 && (
        <InviteTeamStep
          initialInvites={state.invites}
          onNext={handleInvitesNext}
          onBack={() => setStep(3)}
          isLoading={isLoading}
        />
      )}

      {step === 5 && (
        <DataImportStep
          initialOption={state.importOption}
          onNext={handleImportNext}
          onBack={() => setStep(4)}
          isLoading={isLoading}
        />
      )}

      {step === 6 && (
        <DemoDataStep
          onSeed={handleDemoSeed}
          onNext={handleDemoNext}
          onBack={() => setStep(5)}
          isLoading={isLoading}
        />
      )}

      {step === 7 && (
        <PreferencesStep
          initialValues={{
            theme: state.theme,
            emailNotifications: state.emailNotifications,
            smsNotifications: state.smsNotifications,
            dashboardLayout: state.dashboardLayout,
          }}
          onNext={handlePreferencesNext}
          onBack={() => setStep(state.importOption === "DEMO" ? 6 : 5)}
          isLoading={isLoading}
        />
      )}

      {step === 8 && (
        <FinishStep
          orgName={state.orgName}
          enabledModules={state.enabledModules}
          onComplete={handleComplete}
          isLoading={isLoading}
        />
      )}
    </StepLayout>
  );
}
