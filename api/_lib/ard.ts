/**
 * ARD (Agentic Resource Discovery) JSON-LD helpers.
 *
 * Emits spec-faithful agent cards and capability registry entries (plan §3, §4).
 * Every entry carries `@context`, `@type`, and a `did:web` / `urn:air:` identifier.
 * The work-request media type `application/ard-work-request+json` is referenced
 * by `$schema` so downstream registries can validate.
 */

export const ARD_SPEC_VERSION = "1.0";
export const ARD_CONTEXT = "https://agenticresourcediscovery.org/spec/v1/context.jsonld";
export const WORK_REQUEST_MEDIA_TYPE = "application/ard-work-request+json";

export interface ArdHost {
  displayName: string;
  identifier: string; // did:web:...
  documentationUrl: string;
  logoUrl: string;
  contact: string;
}

export function defaultHost(host: string): ArdHost {
  return {
    displayName: "HermesHub",
    identifier: `did:web:${host}`,
    documentationUrl: `https://${host}/docs`,
    logoUrl: `https://${host}/favicon.png`,
    contact: "mailto:hello@hermeshub.xyz",
  };
}

/** URN builders (plan §4.2). */
export const urn = {
  agent: (host: string, handle: string) => `urn:air:${host}:agent:${handle}`,
  work: (host: string, requestId: string) => `urn:air:${host}:work:${requestId}`,
  capability: (uri: string) => `urn:air:capability:${uri}`,
  registry: (host: string) => `urn:air:${host}:registry:main`,
};

export interface AgentCardInput {
  host: string;
  didWeb: string;
  handle: string;
  name: string;
  model?: string | null;
  publicKey: string;
  verified: boolean;
  trustScore: number;
  capabilities: { uri: string; displayName: string; verifiedAt: Date | null }[];
  founderSlot?: number | null;
}

/**
 * Build an ARD-compatible agent card as JSON-LD. Uses schema.org `Person`/
 * `Service` typing for SEO + LLM citation (plan §22.8) layered onto the ARD
 * `@context`.
 */
export function buildAgentCard(input: AgentCardInput): Record<string, unknown> {
  return {
    "@context": [ARD_CONTEXT, "https://schema.org"],
    "@type": ["air:Agent", "Service"],
    specVersion: ARD_SPEC_VERSION,
    identifier: input.didWeb,
    urn: urn.agent(input.host, input.handle),
    name: input.name,
    provider: { "@type": "Organization", name: "HermesHub", identifier: `did:web:${input.host}` },
    model: input.model ?? undefined,
    verified: input.verified,
    trustScore: input.trustScore,
    publicKey: {
      "@type": "air:Ed25519VerificationKey",
      publicKeyHex: input.publicKey,
    },
    founder: input.founderSlot ? { program: "founder-500", slot: input.founderSlot } : undefined,
    capabilities: input.capabilities.map((c) => ({
      "@type": "air:Capability",
      identifier: c.uri,
      name: c.displayName,
      verified: c.verifiedAt != null,
    })),
    url: `https://${input.host}/agents/${input.handle}`,
  };
}

export interface CapabilityEntry {
  uri: string;
  domain: string;
  displayName: string;
  description: string;
  isQualifier: boolean;
  exampleQueries: string[];
  synonyms: string[];
}

/** Build the ARD capability registry document (plan §4 / §5). */
export function buildCapabilityRegistry(
  host: string,
  capabilities: CapabilityEntry[],
): Record<string, unknown> {
  return {
    "@context": ARD_CONTEXT,
    "@type": "air:CapabilityRegistry",
    specVersion: ARD_SPEC_VERSION,
    identifier: urn.registry(host),
    host: defaultHost(host),
    "X-ARD-Spec-Version": ARD_SPEC_VERSION,
    entries: capabilities.map((c) => ({
      "@type": c.isQualifier ? "air:Qualifier" : "air:Capability",
      identifier: c.uri,
      urn: urn.capability(c.uri),
      domain: c.domain,
      name: c.displayName,
      description: c.description,
      exampleQueries: c.exampleQueries,
      synonyms: c.synonyms,
    })),
  };
}

export interface WorkRequestEntryInput {
  host: string;
  publicId: string;
  title: string;
  brief: string;
  capabilityUris: string[];
  budgetCents: number;
  currency: string;
  status: string;
  deadline?: Date | null;
}

/** Build an `application/ard-work-request+json` entry for a posted job. */
export function buildWorkRequestEntry(input: WorkRequestEntryInput): Record<string, unknown> {
  return {
    "@context": ARD_CONTEXT,
    "@type": "air:WorkRequest",
    $schema: `https://${input.host}/specs/ard-work-request.v1.json`,
    specVersion: ARD_SPEC_VERSION,
    identifier: urn.work(input.host, input.publicId),
    mediaType: WORK_REQUEST_MEDIA_TYPE,
    title: input.title,
    description: input.brief,
    capabilities: input.capabilityUris,
    budget: { currency: input.currency, amount: input.budgetCents / 100 },
    status: input.status,
    deadline: input.deadline ? input.deadline.toISOString() : undefined,
    url: `https://${input.host}/work/${input.publicId}`,
  };
}
