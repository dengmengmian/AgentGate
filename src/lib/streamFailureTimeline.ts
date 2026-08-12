/**
 * Build a human-readable stream/request failure timeline from fields already
 * stored on request_logs (trace_json, sse_events, status, error_message).
 *
 * Phases (in order when present):
 *   start → route → upstream → last SSE → failover → end
 */

export type TimelinePhase =
  | "start"
  | "route"
  | "upstream"
  | "sse"
  | "failover"
  | "end";

export type TimelineStatus = "ok" | "error" | "warn" | "info" | "skip";

export type TimelineStep = {
  id: string;
  phase: TimelinePhase;
  status: TimelineStatus;
  /** i18n key under logs.timeline.* */
  titleKey: string;
  /** Optional detail line (already human-readable; may include provider names). */
  detail?: string;
};

export type TimelineTrace = {
  mode?: string;
  route?: string;
  target_url?: string;
  upstream_status?: number;
  client_protocol?: string;
  provider_protocol?: string;
  route_decision?: {
    profile_name?: string;
    mode?: string;
    selected_provider_name?: string;
    selected_model?: string;
    fallback_chain?: Array<{
      provider_name?: string;
      role?: "primary" | "fallback" | string;
      step?: number;
      selected?: boolean;
    }>;
    candidates?: Array<{
      provider_name?: string;
      skip_reasons?: string[];
      in_cooldown?: boolean;
    }>;
  };
  error_mapper?: {
    upstream_code?: string | null;
    upstream_message?: string | null;
    mapped_code?: string;
    mapped_message?: string;
  };
  circuit_breaker?: {
    observed_state?: string;
    transition?: string | null;
  };
  degradation?: {
    requested_model?: string;
    picked?: string | null;
    reason?: string;
  };
};

export type TimelineRequestInput = {
  timestamp?: string | null;
  client?: string | null;
  provider?: string | null;
  model?: string | null;
  route?: string | null;
  status_code?: number | null;
  latency_ms?: number | null;
  error_message?: string | null;
  sse_events?: string | null;
  trace_json?: string | null;
};

/** True when the log is worth showing a failure timeline. */
export function shouldShowFailureTimeline(
  input: TimelineRequestInput
): boolean {
  if (input.error_message && input.error_message.trim()) return true;
  const code = input.status_code;
  if (code != null && (code >= 400 || code < 200)) return true;
  if (
    input.sse_events &&
    /event:\s*error|"error"\s*:/i.test(input.sse_events)
  ) {
    return true;
  }
  return false;
}

export function parseTimelineTrace(
  traceJson: string | null | undefined
): TimelineTrace | null {
  if (!traceJson) return null;
  try {
    return JSON.parse(traceJson) as TimelineTrace;
  } catch {
    return null;
  }
}

/** Extract last non-empty SSE event name / data type from stored stream text. */
export function extractLastSseEvent(sseEvents: string | null | undefined): {
  eventType: string | null;
  dataHint: string | null;
} {
  if (!sseEvents || !sseEvents.trim()) {
    return { eventType: null, dataHint: null };
  }
  let lastEvent: string | null = null;
  let lastDataType: string | null = null;
  let lastDataSnippet: string | null = null;

  for (const raw of sseEvents.split(/\n/)) {
    const line = raw.replace(/\r$/, "");
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) {
      lastEvent = line.slice("event:".length).trim() || null;
      continue;
    }
    if (line.startsWith("data:")) {
      const data = line.slice("data:".length).trim();
      if (!data || data === "[DONE]") {
        lastDataType = data === "[DONE]" ? "[DONE]" : lastDataType;
        continue;
      }
      lastDataSnippet = data.length > 120 ? `${data.slice(0, 117)}…` : data;
      try {
        const v = JSON.parse(data) as { type?: unknown; error?: unknown };
        if (typeof v.type === "string") lastDataType = v.type;
        else if (v.error) lastDataType = "error";
      } catch {
        // keep snippet only
      }
    }
  }

  const eventType = lastEvent || lastDataType;
  return { eventType, dataHint: lastDataSnippet };
}

export function buildStreamFailureTimeline(
  input: TimelineRequestInput
): TimelineStep[] {
  const steps: TimelineStep[] = [];
  const trace = parseTimelineTrace(input.trace_json);
  const decision = trace?.route_decision;

  // 1) start
  {
    const parts: string[] = [];
    if (input.client) parts.push(input.client);
    const route = decision?.profile_name ?? input.route ?? trace?.route;
    if (route) parts.push(route);
    if (trace?.mode) parts.push(trace.mode);
    steps.push({
      id: "start",
      phase: "start",
      status: "info",
      titleKey: "logs.timeline.start",
      detail: parts.length ? parts.join(" · ") : undefined,
    });
  }

  // 2) route / selection
  {
    const provider = decision?.selected_provider_name ?? input.provider ?? null;
    const model = decision?.selected_model ?? input.model ?? null;
    const mode = decision?.mode ?? null;
    const detailParts = [
      provider,
      model,
      mode ? `mode=${mode}` : null,
      trace?.target_url ? truncate(trace.target_url, 64) : null,
    ].filter(Boolean) as string[];
    const skipped = (decision?.candidates ?? []).filter(
      (c) => c.skip_reasons && c.skip_reasons.length > 0
    );
    if (skipped.length) {
      detailParts.push(
        `skip: ${skipped
          .map(
            (c) =>
              `${c.provider_name ?? "?"}(${(c.skip_reasons ?? []).join(",")})`
          )
          .join(", ")}`
      );
    }
    steps.push({
      id: "route",
      phase: "route",
      status: provider ? "ok" : "warn",
      titleKey: "logs.timeline.route",
      detail: detailParts.length ? detailParts.join(" · ") : undefined,
    });
  }

  // 3) upstream status
  {
    const upstream =
      trace?.upstream_status ??
      (input.status_code != null ? input.status_code : null);
    const isBad = upstream != null && (upstream >= 400 || upstream < 200);
    steps.push({
      id: "upstream",
      phase: "upstream",
      status: isBad ? "error" : upstream != null ? "ok" : "warn",
      titleKey: "logs.timeline.upstream",
      detail:
        upstream != null
          ? `HTTP ${upstream}`
          : input.error_message
            ? "—"
            : undefined,
    });
  }

  // 4) last SSE event (only when we have stream bytes)
  {
    const { eventType, dataHint } = extractLastSseEvent(input.sse_events);
    if (eventType || dataHint) {
      const isErr =
        (eventType && /error/i.test(eventType)) ||
        (dataHint != null && /"error"\s*:/.test(dataHint));
      steps.push({
        id: "sse",
        phase: "sse",
        status: isErr ? "error" : "info",
        titleKey: "logs.timeline.sse",
        detail: [eventType, dataHint].filter(Boolean).join(" · ") || undefined,
      });
    }
  }

  // 5) failover / retry chain
  {
    const chain = decision?.fallback_chain ?? [];
    if (chain.length > 0) {
      const labels = chain.map((s, i) => {
        const n = s.step ?? i + 1;
        const role = s.role === "primary" ? "primary" : "fallback";
        const mark = s.selected ? "*" : "";
        return `${n}.${role}${mark} ${s.provider_name ?? "—"}`;
      });
      const multi = chain.length > 1;
      steps.push({
        id: "failover",
        phase: "failover",
        status: multi ? "warn" : "info",
        titleKey: multi
          ? "logs.timeline.failover"
          : "logs.timeline.failover_single",
        detail: labels.join(" → "),
      });
    }
  }

  // 6) end reason
  {
    const parts: string[] = [];
    if (input.status_code != null) parts.push(`HTTP ${input.status_code}`);
    if (input.latency_ms != null) parts.push(`${input.latency_ms}ms`);
    if (input.error_message) {
      parts.push(truncate(input.error_message, 160));
    }
    if (trace?.error_mapper) {
      const m = trace.error_mapper;
      parts.push(
        `map ${m.upstream_code ?? "upstream"}→${m.mapped_code ?? "mapped"}`
      );
    }
    if (trace?.circuit_breaker) {
      const b = trace.circuit_breaker;
      parts.push(
        `breaker ${b.observed_state ?? "?"}${b.transition ? `/${b.transition}` : ""}`
      );
    }
    if (trace?.degradation) {
      const d = trace.degradation;
      parts.push(
        `degrade ${d.requested_model ?? "?"}→${d.picked ?? "—"}${d.reason ? ` (${d.reason})` : ""}`
      );
    }
    const hasError =
      !!input.error_message ||
      (input.status_code != null &&
        (input.status_code >= 400 || input.status_code < 200));
    steps.push({
      id: "end",
      phase: "end",
      status: hasError ? "error" : "ok",
      titleKey: hasError ? "logs.timeline.end_fail" : "logs.timeline.end_ok",
      detail: parts.length ? parts.join(" · ") : undefined,
    });
  }

  return steps;
}

function truncate(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}
