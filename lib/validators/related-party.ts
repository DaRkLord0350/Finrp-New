// ============================================================
// lib/validators/related-party.ts
// Zod schemas + inferred DTOs for Modules 4+5 (Authorized
// Signatories, Directors/Partners/Proprietors/LLP Members/
// Beneficial Owners) — unified OrganizationRelatedParty registry.
// ============================================================

import { z } from "zod";

export const PartyRoleEnum = z.enum([
  "DIRECTOR",
  "PARTNER",
  "PROPRIETOR",
  "LLP_MEMBER",
  "BENEFICIAL_OWNER",
  "AUTHORIZED_SIGNATORY",
  "AUTHORIZED_CONTACT",
]);

const partyFields = {
  roles: z.array(PartyRoleEnum).min(1, "Select at least one role"),
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().optional().nullable().or(z.literal("")),
  phone: z.string().trim().max(20).optional().nullable(),

  pan: z.string().trim().max(10).optional().nullable(),
  din: z.string().trim().max(20).optional().nullable(),
  shareholdingPercent: z.coerce.number().min(0).max(100).optional().nullable(),
  designation: z.string().trim().max(100).optional().nullable(),
  isPrimarySignatory: z.boolean().optional(),

  addressLine: z.string().trim().max(500).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).optional().nullable(),
  country: z.string().trim().max(100).optional().nullable(),
  pincode: z.string().trim().max(20).optional().nullable(),

  notes: z.string().trim().max(1000).optional().nullable(),
};

export const CreateRelatedPartySchema = z.object(partyFields);
export type CreateRelatedPartyInput = z.infer<typeof CreateRelatedPartySchema>;

export const UpdateRelatedPartySchema = z.object(partyFields).partial();
export type UpdateRelatedPartyInput = z.infer<typeof UpdateRelatedPartySchema>;
