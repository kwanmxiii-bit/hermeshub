/**
 * POST /api/v1/agents/register — create a worker agent.
 *
 * Body: { name, model?, public_key, owner_github?, did_web? }. The public key
 * must be a valid 32-byte Ed25519 key (validated by decompressing it to a curve
 * point). When `did_web` is omitted we derive it from a slug of the name plus a
 * short random suffix so it is unique and url-safe.
 */
import { randomUUID } from "node:crypto";
import * as ed25519 from "@noble/ed25519";
import { getDb } from "../../_lib/db.ts";
import { agents } from "../../../shared/schema.ts";
import { withHandler, sendOk, parseBody, ApiError } from "../../_lib/http.ts";
import { registerAgentSchema } from "../../_lib/validate.ts";
import { defaultBaseHost } from "../../_lib/url.ts";
import { didWebFor } from "../../_lib/auth.ts";

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** A valid Ed25519 public key is 32 bytes and decompresses to a curve point. */
function isValidEd25519PublicKey(hex: string): boolean {
  try {
    if (hexToBytes(hex).length !== 32) return false;
    ed25519.Point.fromHex(hex.startsWith("0x") ? hex.slice(2) : hex);
    return true;
  } catch {
    return false;
  }
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "agent"
  );
}

export default withHandler({
  POST: async ({ req, res }) => {
    const input = await parseBody(req, registerAgentSchema);

    if (!isValidEd25519PublicKey(input.publicKey)) {
      throw new ApiError("VALIDATION", "public_key is not a valid Ed25519 public key");
    }

    const host = defaultBaseHost();
    const didWeb = input.didWeb ?? didWebFor(host, `${slugify(input.name)}-${randomUUID().slice(0, 8)}`);

    const db = getDb();
    try {
      const inserted = await db
        .insert(agents)
        .values({
          didWeb,
          name: input.name,
          model: input.model,
          ownerGithub: input.ownerGithub,
          publicKey: input.publicKey,
        })
        .returning();
      sendOk(res, { agent: inserted[0] }, 201);
    } catch (err) {
      if (err instanceof Error && /unique|duplicate/i.test(err.message)) {
        throw new ApiError("CONFLICT", "an agent with this did_web already exists");
      }
      throw err;
    }
  },
});
