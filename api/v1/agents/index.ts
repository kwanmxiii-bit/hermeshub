/**
 * GET /api/v1/agents — agent directory.
 *
 * Filters: `?capability=hct:video:edit:short-form` (declared by the agent),
 * `?domain=video` (any declared capability in that domain), `?q=` (name /
 * did_web / owner substring). Paginated via `?limit=` (default 20, max 100) +
 * `?offset=`.
 */
import { and, eq, or, ilike, inArray, sql } from "drizzle-orm";
import { getDb } from "../../_lib/db.ts";
import { agents, agentCapabilities, capabilities } from "../../../shared/schema.ts";
import { withHandler, sendOk, param, intParam } from "../../_lib/http.ts";

export default withHandler({
  GET: async ({ req, res }) => {
    const db = getDb();
    const capability = param(req, "capability");
    const domain = param(req, "domain");
    const q = param(req, "q");
    const limit = intParam(req, "limit", 20, 100);
    const off = Math.max(0, Number.parseInt(param(req, "offset") ?? "0", 10) || 0);

    const conditions = [];

    // Restrict to agents that declare a matching capability / domain.
    if (capability || domain) {
      const capConds = [];
      if (capability) capConds.push(eq(agentCapabilities.capabilityUri, capability));
      if (domain) capConds.push(eq(capabilities.domain, domain));
      const matching = await db
        .selectDistinct({ agentId: agentCapabilities.agentId })
        .from(agentCapabilities)
        .innerJoin(capabilities, eq(capabilities.uri, agentCapabilities.capabilityUri))
        .where(and(...capConds));
      const ids = matching.map((r) => r.agentId);
      if (ids.length === 0) {
        sendOk(res, { agents: [], total: 0, limit, offset: off });
        return;
      }
      conditions.push(inArray(agents.id, ids));
    }

    if (q) {
      const like = `%${q}%`;
      conditions.push(
        or(ilike(agents.name, like), ilike(agents.didWeb, like), ilike(agents.ownerGithub, like)),
      );
    }

    const where = conditions.length ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: agents.id,
        agentId: agents.agentId,
        didWeb: agents.didWeb,
        name: agents.name,
        model: agents.model,
        ownerGithub: agents.ownerGithub,
        verified: agents.verified,
        trustScore: agents.trustScore,
        createdAt: agents.createdAt,
      })
      .from(agents)
      .where(where)
      .orderBy(sql`${agents.trustScore} DESC`, agents.createdAt)
      .limit(limit)
      .offset(off);

    const countRows = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(agents)
      .where(where);

    sendOk(res, { agents: rows, total: countRows[0]?.n ?? 0, limit, offset: off });
  },
});
