/**
 * Shared entity lookups used across multiple route handlers.
 *
 * Keeps resolution logic (flexible agent id, requester upsert-by-did) in one
 * place so every endpoint resolves identities identically.
 */
import { eq, or } from "drizzle-orm";
import { getDb } from "./db.ts";
import {
  agents,
  requesters,
  work_requests,
  type Agent,
  type Requester,
  type WorkRequest,
} from "../../shared/schema.ts";
import { ApiError } from "./http.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve an agent by any of its public identifiers: the primary `id` UUID, the
 * stable `agent_id` UUID, or the `did_web` string. Returns null if not found.
 */
export async function findAgent(idOrDid: string): Promise<Agent | null> {
  const db = getDb();
  const conditions = [eq(agents.didWeb, idOrDid)];
  if (UUID_RE.test(idOrDid)) {
    conditions.push(eq(agents.id, idOrDid), eq(agents.agentId, idOrDid));
  }
  const rows = await db
    .select()
    .from(agents)
    .where(or(...conditions))
    .limit(1);
  return rows[0] ?? null;
}

export async function requireAgent(idOrDid: string): Promise<Agent> {
  const agent = await findAgent(idOrDid);
  if (!agent) throw new ApiError("NOT_FOUND", `agent not found: ${idOrDid}`);
  return agent;
}

/** Load a work request by its public id, or throw 404. */
export async function requireWork(publicId: string): Promise<WorkRequest> {
  const rows = await getDb()
    .select()
    .from(work_requests)
    .where(eq(work_requests.publicId, publicId))
    .limit(1);
  if (!rows[0]) throw new ApiError("NOT_FOUND", `work not found: ${publicId}`);
  return rows[0];
}

/** Look up an existing requester by did:web, or create a bare one. */
export async function upsertRequesterByDid(didWeb: string, name?: string): Promise<Requester> {
  const db = getDb();
  const existing = await db
    .select()
    .from(requesters)
    .where(eq(requesters.didWeb, didWeb))
    .limit(1);
  if (existing[0]) return existing[0];

  const inserted = await db
    .insert(requesters)
    .values({ didWeb, name })
    .onConflictDoNothing({ target: requesters.didWeb })
    .returning();
  if (inserted[0]) return inserted[0];

  // Lost an insert race; re-read.
  const reread = await db
    .select()
    .from(requesters)
    .where(eq(requesters.didWeb, didWeb))
    .limit(1);
  if (!reread[0]) throw new ApiError("INTERNAL", "failed to upsert requester");
  return reread[0];
}
