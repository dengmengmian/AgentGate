import { describe, expect, it } from "vitest";
import {
  buildReproPackage,
  estimateCacheSavingsUsd,
  pairBodies,
  redactSecrets,
} from "./requestLogDebug";

describe("pairBodies", () => {
  it("pairs request and response when present", () => {
    const pairs = pairBodies({
      raw_request: '{"a":1}',
      converted_request: '{"b":2}',
      raw_response: null,
      converted_response: '{"c":3}',
    });
    expect(pairs).toHaveLength(2);
    expect(pairs[0].label).toBe("request");
    expect(pairs[0].raw).toContain("a");
    expect(pairs[1].label).toBe("response");
    expect(pairs[1].converted).toContain("c");
  });
});

describe("redactSecrets", () => {
  it("masks sk- api keys", () => {
    const out = redactSecrets(
      "api_key is sk-abcdefghijklmnopqrstuvwxyz in body"
    );
    expect(out).not.toContain("sk-abcdefghijklmnopqrstuvwxyz");
    expect(out).toContain("sk-");
    expect(out).toContain("••••");
  });

  it("masks Bearer tokens", () => {
    const out = redactSecrets(
      "Authorization: Bearer sk-abcdefghijklmnopqrstuvwxyz"
    );
    expect(out).not.toContain("sk-abcdefghijklmnopqrstuvwxyz");
  });
});

describe("buildReproPackage", () => {
  it("redacts keys and keeps metadata", () => {
    const pkg = buildReproPackage({
      request_id: "req_1",
      app_version: "1.5.1",
      include_bodies: true,
      error_message: "bad sk-abcdefghijklmnopqrstuvwxyz",
      raw_request: '{"api_key":"sk-abcdefghijklmnopqrstuvwxyz"}',
      trace_json: JSON.stringify({
        route_decision: { profile_name: "default" },
      }),
    });
    expect(pkg).not.toContain("sk-abcdefghijklmnopqrstuvwxyz");
    expect(pkg).toContain("req_1");
    expect(pkg).toContain("secrets_redacted");
    expect(pkg).toContain("route_decision");
  });

  it("omits bodies when include_bodies is false", () => {
    const pkg = buildReproPackage({
      request_id: "req_2",
      app_version: "1.5.1",
      include_bodies: false,
      raw_request: '{"secret":"sk-abcdefghijklmnopqrstuvwxyz"}',
    });
    const parsed = JSON.parse(pkg) as Record<string, unknown>;
    expect(parsed.raw_request).toBeUndefined();
  });
});

describe("estimateCacheSavingsUsd", () => {
  it("returns null without real cache read data", () => {
    expect(estimateCacheSavingsUsd(0, 3)).toBeNull();
    expect(estimateCacheSavingsUsd(1000, null)).toBeNull();
  });

  it("estimates 90% of input price for cache hits", () => {
    // 1M tokens * $3/M * 0.9 = $2.7
    expect(estimateCacheSavingsUsd(1_000_000, 3)).toBeCloseTo(2.7);
  });
});
