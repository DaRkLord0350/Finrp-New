// ============================================================
// lib/tax/validation/registry.ts
//
// Central registry mapping handlerKey → handler and exposing the
// default (code) rule definitions per scheme. New modules add their
// handlers + definitions here. The engine consults the DB first; this
// registry both supplies the handler implementations AND the zero-
// config defaults when no DB rows exist for a scheme.
// ============================================================

import type { TaxScheme } from "@prisma/client";
import type { RuleDefinition, RuleHandler } from "./types";
import { GST_HANDLERS, GST_RULE_DEFINITIONS } from "./rules/gst";

const HANDLERS: Record<string, RuleHandler> = {
  ...(GST_HANDLERS as Record<string, RuleHandler>),
  // ...future: TDS_HANDLERS, INCOME_TAX_HANDLERS, etc.
};

const DEFAULT_DEFINITIONS: RuleDefinition[] = [
  ...GST_RULE_DEFINITIONS,
  // ...future scheme definitions
];

export function getHandler(handlerKey: string): RuleHandler | undefined {
  return HANDLERS[handlerKey];
}

export function defaultRuleDefinitions(scheme?: TaxScheme): RuleDefinition[] {
  return scheme ? DEFAULT_DEFINITIONS.filter((d) => d.scheme === scheme) : DEFAULT_DEFINITIONS;
}

export { HANDLERS, DEFAULT_DEFINITIONS };
