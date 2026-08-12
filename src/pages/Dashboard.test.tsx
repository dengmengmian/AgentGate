import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act, waitFor, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/lib/api");

import * as api from "@/lib/api";
import { Dashboard } from "./Dashboard";
import { __resetGlobalStoresForTest } from "@/store/global";

afterEach(() => cleanup());

function gatewayStatus(): any {
  return {
    running: true,
    host: "127.0.0.1",
    port: 4141,
    input_protocol: "openai_responses",
    output_protocol: "openai_chat_completions",
    active_provider: "OpenAI",
    started_at: "2026-06-16T00:00:00Z",
  };
}

function gatewaySettings(): any {
  return {
    host: "127.0.0.1",
    port: 4141,
    input_protocol: "openai_responses",
    output_protocol: "openai_chat_completions",
    auto_start: true,
    log_retention_days: 30,
  };
}

describe("Dashboard", () => {
  beforeEach(() => {
    __resetGlobalStoresForTest();
    vi.mocked(api.listTools).mockResolvedValue([]);
    vi.mocked(api.listRequestLogs).mockResolvedValue([]);
    vi.mocked(api.getRequestStatsRange).mockResolvedValue({ total: 0 } as any);
    vi.mocked(api.aggregateCostByModel).mockResolvedValue([]);
    vi.mocked(api.aggregateCostByClient).mockResolvedValue([]);
    vi.mocked(api.aggregateRouteProfileStats).mockResolvedValue([]);
    vi.mocked(api.getGatewayStatus).mockResolvedValue(gatewayStatus());
    vi.mocked(api.getGatewaySettings).mockResolvedValue(gatewaySettings());
    vi.mocked(api.getRuntimeKpis).mockResolvedValue({
      active_requests: 0,
      uptime_seconds: 0,
      total_requests: 0,
      total_tokens: 0,
      total_cost: 0,
      success_rate_lifetime: 100,
      gateway_running: false,
    } as any);
    vi.mocked(api.listProviders).mockResolvedValue([]);
    vi.mocked(api.listRouteProfiles).mockResolvedValue([]);
    vi.mocked(api.startGateway).mockResolvedValue(gatewayStatus());
    vi.mocked(api.stopGateway).mockResolvedValue({
      ...gatewayStatus(),
      running: false,
    });
    vi.mocked(api.restartGateway).mockResolvedValue(gatewayStatus());
    // Client detects: default = not AgentGate-wired (even if config files exist).
    vi.mocked(api.detectCodexConfig).mockResolvedValue({
      exists: true,
      has_agentgate: false,
    } as any);
    vi.mocked(api.detectClaudeCodeEnv).mockResolvedValue({
      settings_exists: true,
      has_agentgate: false,
    } as any);
    vi.mocked(api.detectOpenCodeConfig).mockResolvedValue({
      exists: true,
      has_agentgate: false,
    } as any);
    vi.mocked(api.detectGeminiConfig).mockResolvedValue({
      exists: true,
      has_agentgate: false,
    } as any);
    vi.mocked(api.detectAtomCodeConfig).mockResolvedValue({
      exists: true,
      has_agentgate: false,
    } as any);
  });

  it("renders and fetches initial data", async () => {
    vi.mocked(api.listProviders).mockResolvedValue([{ id: "p1" }] as any);
    vi.mocked(api.getRequestStatsRange).mockResolvedValue({
      total: 1,
      today_total: 1,
      today_errors: 0,
      today_input_tokens: 100,
      today_output_tokens: 50,
      today_cost: 0.01,
      avg_latency_ms: 1000,
      today_codex_compact: 0,
      today_cache_read_tokens: 0,
      today_cache_write_tokens: 0,
      daily: [
        {
          date: "2026-07-07",
          total: 1,
          errors: 0,
          input_tokens: 100,
          output_tokens: 50,
        },
      ],
      providers: [{ name: "OpenAI", count: 1 }],
    } as any);

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(api.listTools).toHaveBeenCalled();
      expect(api.listRequestLogs).toHaveBeenCalledWith({ limit: 5 });
      expect(api.getRequestStatsRange).toHaveBeenCalledWith(7);
      expect(api.detectCodexConfig).toHaveBeenCalled();
    });
    expect(screen.getByText("dashboard.control_console")).toBeInTheDocument();
    expect(screen.getByText("stats.today_realtime")).toBeInTheDocument();
    expect(screen.getByText("stats.traffic_monitor")).toBeInTheDocument();
  });

  it("stops gateway when stop button is clicked", async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    const stop = await screen.findByText("dashboard.stop");
    await act(async () => stop.click());
    await waitFor(() => expect(api.stopGateway).toHaveBeenCalled());
  });

  it("treats seeded provider without key as not ready — shows setup CTA", async () => {
    // Fresh install seeds DeepSeek with empty key; local client files may exist.
    vi.mocked(api.listProviders).mockResolvedValue([
      {
        id: "p1",
        name: "DeepSeek",
        enabled: true,
        masked_api_key: null,
      },
    ] as any);
    vi.mocked(api.listTools).mockResolvedValue([
      {
        id: "codex",
        name: "Codex",
        slug: "codex",
        config_exists: true,
      },
      {
        id: "claude-code",
        name: "Claude Code",
        slug: "claude-code",
        config_exists: true,
      },
    ] as any);
    vi.mocked(api.getRequestStatsRange).mockResolvedValue({
      total: 0,
      today_total: 0,
    } as any);

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(
      await screen.findByText("dashboard.empty_title")
    ).toBeInTheDocument();
    expect(screen.queryByText("dashboard.no_requests_ready_title")).toBeNull();
    expect(screen.queryByText("codex")).toBeNull();
  });

  it("asks to apply clients when key exists but no AgentGate-wired client", async () => {
    vi.mocked(api.listProviders).mockResolvedValue([
      {
        id: "p1",
        name: "DeepSeek",
        enabled: true,
        masked_api_key: "sk-s****abcd",
      },
    ] as any);
    // config_exists=true for all tools must NOT mean ready
    vi.mocked(api.listTools).mockResolvedValue([
      { id: "codex", slug: "codex", config_exists: true },
      { id: "claude-code", slug: "claude-code", config_exists: true },
      { id: "opencode", slug: "opencode", config_exists: true },
      { id: "atomcode", slug: "atomcode", config_exists: true },
      { id: "gemini_cli", slug: "gemini-cli", config_exists: true },
    ] as any);
    vi.mocked(api.getRequestStatsRange).mockResolvedValue({
      total: 0,
      today_total: 0,
    } as any);

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(
      await screen.findByText("dashboard.no_requests_config_title")
    ).toBeInTheDocument();
    expect(screen.queryByText("dashboard.no_requests_ready_title")).toBeNull();
    // Must not list every local client as launchable
    expect(screen.queryByText("opencode")).toBeNull();
    expect(screen.queryByText("atomcode")).toBeNull();
    expect(screen.queryByText("gemini")).toBeNull();
  });

  it("shows first-request commands only for AgentGate-wired clients", async () => {
    vi.mocked(api.listProviders).mockResolvedValue([
      {
        id: "p1",
        name: "DeepSeek",
        enabled: true,
        masked_api_key: "sk-s****abcd",
      },
    ] as any);
    vi.mocked(api.listTools).mockResolvedValue([
      { id: "codex", slug: "codex", config_exists: true },
      { id: "claude-code", slug: "claude-code", config_exists: true },
      { id: "opencode", slug: "opencode", config_exists: true },
    ] as any);
    vi.mocked(api.detectCodexConfig).mockResolvedValue({
      exists: true,
      has_agentgate: true,
    } as any);
    vi.mocked(api.detectClaudeCodeEnv).mockResolvedValue({
      settings_exists: true,
      has_agentgate: false,
    } as any);
    vi.mocked(api.getRequestStatsRange).mockResolvedValue({
      total: 0,
      today_total: 0,
      today_errors: 0,
      today_input_tokens: 0,
      today_output_tokens: 0,
      today_cost: 0,
      avg_latency_ms: 0,
      today_codex_compact: 0,
      today_cache_read_tokens: 0,
      today_cache_write_tokens: 0,
      daily: [],
      providers: [],
    } as any);

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(
      await screen.findByText("dashboard.no_requests_ready_title")
    ).toBeInTheDocument();
    expect(screen.getByText("codex")).toBeInTheDocument();
    // Claude / OpenCode not wired → must not appear
    expect(screen.queryByText("claude")).toBeNull();
    expect(screen.queryByText("opencode")).toBeNull();
    expect(
      screen.getByText("dashboard.no_requests_ready_cta").closest("a")
    ).toHaveAttribute("href", "/tools");
  });
});
