"use client";

// ============================================================
// components/billing/useRazorpayCheckout.ts
//
// Client hook that drives the Razorpay Checkout flow:
//   1. POST /api/billing/checkout      → create order (server)
//   2. open Razorpay Checkout          → user pays
//   3. POST /api/billing/verify        → server verifies signature + activates
//
// The hook never trusts the in-browser result; activation only happens
// after the server verifies the signature in step 3.
// ============================================================

import { useCallback, useRef, useState } from "react";

interface RazorpayHandlerResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}
interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (resp: RazorpayHandlerResponse) => void;
  modal?: { ondismiss?: () => void };
}
interface RazorpayInstance {
  open: () => void;
}
declare global {
  interface Window {
    Razorpay?: new (opts: RazorpayOptions) => RazorpayInstance;
  }
}

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export interface CheckoutCallbacks {
  onSuccess: (data: unknown) => void;
  onError: (message: string) => void;
  onCancel?: () => void;
}

export function useRazorpayCheckout() {
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const settledRef = useRef(false);

  const startCheckout = useCallback(
    async (planType: string, cb: CheckoutCallbacks) => {
      settledRef.current = false;
      setBusyPlan(planType);
      try {
        const res = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planType }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setBusyPlan(null);
          return cb.onError(data.error ?? "Could not start checkout");
        }
        if (!data.keyId) {
          setBusyPlan(null);
          return cb.onError("Payments are not configured. Please contact support.");
        }

        const loaded = await loadScript();
        if (!loaded || !window.Razorpay) {
          setBusyPlan(null);
          return cb.onError("Could not load the payment gateway. Check your connection.");
        }

        const rzp = new window.Razorpay({
          key: data.keyId,
          amount: data.amount,
          currency: data.currency,
          order_id: data.orderId,
          name: "FinRP",
          description: `${data.planName} plan — monthly`,
          prefill: data.prefill,
          theme: { color: "#6366f1" },
          handler: async (resp) => {
            if (settledRef.current) return;
            settledRef.current = true;
            try {
              const v = await fetch("/api/billing/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(resp),
              });
              const vd = await v.json().catch(() => ({}));
              setBusyPlan(null);
              if (v.ok) cb.onSuccess(vd);
              else cb.onError(vd.error ?? "Payment verification failed");
            } catch {
              setBusyPlan(null);
              cb.onError("Could not verify the payment. If you were charged, contact support.");
            }
          },
          modal: {
            ondismiss: () => {
              if (settledRef.current) return;
              settledRef.current = true;
              setBusyPlan(null);
              cb.onCancel?.();
            },
          },
        });
        rzp.open();
      } catch {
        setBusyPlan(null);
        cb.onError("Something went wrong starting checkout.");
      }
    },
    []
  );

  return { startCheckout, busyPlan };
}
