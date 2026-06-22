/**
 * Zod validation schemas for every mutating API surface (brief constraint #1).
 *
 * Handlers parse untrusted input through these before touching the database, so
 * the boundary is the only place validation happens — internal callers trust the
 * parsed types. Money is accepted as integer cents; URIs and ids are length- and
 * charset-bounded to limit abuse.
 */
import { z } from "zod";
import { WORK_STATUSES, PRICING_TYPES } from "../../shared/schema.ts";

const cents = z.number().int().nonnegative();
const hex = z.string().regex(/^(0x)?[0-9a-fA-F]+$/, "must be hex");
const capabilityUri = z
  .string()
  .min(3)
  .max(160)
  .regex(/^hctq?:[a-z0-9:-]+$/, "must be an hct capability URI");

export const registerAgentSchema = z.object({
  name: z.string().min(1).max(255),
  handle: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-zA-Z0-9._-]+$/, "handle must be url-safe"),
  model: z.string().max(120).optional(),
  ownerGithub: z.string().max(120).optional(),
  publicKey: hex.max(128),
  signature: hex.max(256),
});
export type RegisterAgentInput = z.infer<typeof registerAgentSchema>;

export const declareCapabilitySchema = z.object({
  capabilityUri,
  slaP95Ms: z.number().int().positive().optional(),
  priceMinCents: cents.optional(),
  priceMaxCents: cents.optional(),
  sandboxUrl: z.string().url().max(2048).optional(),
});
export type DeclareCapabilityInput = z.infer<typeof declareCapabilitySchema>;

export const createWorkSchema = z.object({
  requesterId: z.string().uuid(),
  title: z.string().min(3).max(255),
  brief: z.string().min(10).max(20000),
  capabilityUris: z.array(capabilityUri).max(20).default([]),
  budgetCents: cents.max(100_000_000), // ≤ $1M
  currency: z.string().length(3).toLowerCase().default("usd"),
  pricingType: z.enum(PRICING_TYPES).default("fixed"),
  ipLicense: z.string().max(40).default("work-for-hire"),
  visibility: z.enum(["public", "unlisted", "private"]).default("public"),
  deadline: z.coerce.date().optional(),
});
export type CreateWorkInput = z.infer<typeof createWorkSchema>;

export const submitBidSchema = z.object({
  agentId: z.string().uuid(),
  priceCents: cents.max(100_000_000),
  etaHours: z.number().int().positive().max(8760).optional(),
  message: z.string().max(5000).optional(),
  signature: hex.max(256).optional(),
});
export type SubmitBidInput = z.infer<typeof submitBidSchema>;

export const awardSchema = z.object({
  bidId: z.string().uuid(),
});
export type AwardInput = z.infer<typeof awardSchema>;

export const checkoutSchema = z.object({
  successUrl: z.string().url().max(2048),
  cancelUrl: z.string().url().max(2048),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const stripeOnboardSchema = z.object({
  email: z.string().email().max(320).optional(),
  refreshUrl: z.string().url().max(2048),
  returnUrl: z.string().url().max(2048),
});
export type StripeOnboardInput = z.infer<typeof stripeOnboardSchema>;

export const founderClaimSchema = z.object({
  agentId: z.string().uuid(),
  didWeb: z.string().min(7).max(512).regex(/^did:web:/, "must be a did:web URN"),
});
export type FounderClaimInput = z.infer<typeof founderClaimSchema>;

export const workStatusSchema = z.enum(WORK_STATUSES);

/** Parse helper returning a typed result or a flat error list. */
export function safeParse<T>(schema: z.ZodType<T>, input: unknown):
  | { ok: true; data: T }
  | { ok: false; errors: string[] } {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    errors: result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
  };
}
