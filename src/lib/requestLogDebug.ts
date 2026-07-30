/**
 * Request-log debug helpers: body pairing for Diff UI + redacted repro export.
 * Redaction intentionally mirrors backend `security::redaction` patterns for
 * Issue-safe paste (keys never leave the machine unmasked).
 */

export type BodyPair = {
  label: string;
  raw: string | null;
  converted: string | null;
};

/** Pair raw/converted request and response for side-by-side Diff tabs. */
export function pairBodies(detail: {
  raw_request?: string | null;
  converted_request?: string | null;
  raw_response?: string | null;
  converted_response?: string | null;
}): BodyPair[] {
  const pairs: BodyPair[] = [];
  if (detail.raw_request || detail.converted_request) {
    pairs.push({
      label: "request",
      raw: detail.raw_request ?? null,
      converted: detail.converted_request ?? null,
    });
  }
  if (detail.raw_response || detail.converted_response) {
    pairs.push({
      label: "response",
      raw: detail.raw_response ?? null,
      converted: detail.converted_response ?? null,
    });
  }
  return pairs;
}

/** Mask obvious secret substrings in free text (client-side export). */
export function redactSecrets(text: string): string {
  let s = text;
  // sk-… keys
  s = s.replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, (m) => {
    if (m.length <= 12) return "sk-••••";
    return `${m.slice(0, 3)}••••••••${m.slice(-4)}`;
  });
  // ag_local_ tokens
  s = s.replace(/\bag_local_[A-Za-z0-9_-]{8,}\b/g, (m) => {
    return `${m.slice(0, 9)}••••••••${m.slice(-4)}`;
  });
  // Bearer tokens
  s = s.replace(
    /(Bearer\s+)([A-Za-z0-9._\-+=/]{12,})/gi,
    (_m, p1: string, tok: string) =>
      `${p1}${tok.slice(0, 4)}••••••••${tok.slice(-4)}`
  );
  // "api_key": "…" / "api-key": "…"
  s = s.replace(
    /("?(?:api[_-]?key|x-api-key|access_token)"?\s*[:=]\s*")([^"]{8,})(")/gi,
    (_m, a: string, val: string, c: string) =>
      `${a}${val.slice(0, 4)}••••••••${val.slice(-4)}${c}`
  );
  return s;
}

export type ReproExportInput = {
  request_id: string;
  timestamp?: string | null;
  client?: string | null;
  provider?: string | null;
  model?: string | null;
  route?: string | null;
  status_code?: number | null;
  latency_ms?: number | null;
  error_message?: string | null;
  trace_json?: string | null;
  raw_request?: string | null;
  converted_request?: string | null;
  raw_response?: string | null;
  converted_response?: string | null;
  app_version: string;
  include_bodies: boolean;
};

/** Assemble a pretty JSON repro package with secrets redacted. */
export function buildReproPackage(input: ReproExportInput): string {
  const body: Record<string, unknown> = {
    format: "agentgate-repro-v1",
    app_version: input.app_version,
    request_id: input.request_id,
    timestamp: input.timestamp ?? null,
    client: input.client ?? null,
    provider: input.provider ?? null,
    model: input.model ?? null,
    route: input.route ?? null,
    status_code: input.status_code ?? null,
    latency_ms: input.latency_ms ?? null,
    error_message: input.error_message
      ? redactSecrets(input.error_message)
      : null,
    secrets_redacted: true,
  };

  if (input.trace_json) {
    body.trace_json = redactSecrets(input.trace_json);
    try {
      const t = JSON.parse(input.trace_json) as Record<string, unknown>;
      if (t.route_decision) body.route_decision = t.route_decision;
      if (t.error_mapper) body.error_mapper = t.error_mapper;
    } catch {
      /* ignore */
    }
  }

  if (input.include_bodies) {
    body.raw_request = input.raw_request
      ? redactSecrets(input.raw_request)
      : null;
    body.converted_request = input.converted_request
      ? redactSecrets(input.converted_request)
      : null;
    body.raw_response = input.raw_response
      ? redactSecrets(input.raw_response)
      : null;
    body.converted_response = input.converted_response
      ? redactSecrets(input.converted_response)
      : null;
  }

  return JSON.stringify(body, null, 2);
}

/** Estimate Anthropic-style cache savings only when real cache_read exists. */
export function estimateCacheSavingsUsd(
  cacheReadTokens: number,
  inputPricePerMillion: number | null | undefined
): number | null {
  if (
    !cacheReadTokens ||
    cacheReadTokens <= 0 ||
    inputPricePerMillion == null ||
    !(inputPricePerMillion > 0)
  ) {
    return null;
  }
  // Anthropic cache hits are billed at ~10% of base input; savings ≈ 90%.
  return (cacheReadTokens / 1_000_000) * inputPricePerMillion * 0.9;
}
