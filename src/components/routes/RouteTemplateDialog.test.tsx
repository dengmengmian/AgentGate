import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { RouteTemplateDialog } from "./RouteTemplateDialog";
import { renderWithProviders } from "@/components/test-utils";

vi.mock("@/lib/api");

import * as api from "@/lib/api";

const preview = {
  template_id: "task_split",
  profile_ids: ["r1"],
  profile_names: ["Codex Default"],
  roles: [
    {
      role: "background",
      provider_id: "p-bg",
      provider_name: "Cheap",
      is_local: false,
      routing_conditions: '{"model_name_match":["haiku"]}',
      priority: 1,
    },
    {
      role: "main",
      provider_id: "p-main",
      provider_name: "Cloud",
      is_local: false,
      routing_conditions: null,
      priority: 2,
    },
  ],
  warnings: ["will_enable_failover"],
  can_apply: true,
  can_rollback: false,
  switches_to_failover: true,
};

const providers = [
  { id: "p-main", name: "Cloud", base_url: "https://api.cloud.example" },
  { id: "p-bg", name: "Cheap", base_url: "https://api.cheap.example" },
  { id: "p-local", name: "Ollama", base_url: "http://127.0.0.1:11434/v1" },
];

function setup() {
  const onClose = vi.fn();
  const onApplied = vi.fn();
  const onRollback = vi.fn();
  renderWithProviders(
    <RouteTemplateDialog
      profileId="r1"
      providers={providers}
      canRollback={false}
      onClose={onClose}
      onApplied={onApplied}
      onRollback={onRollback}
    />
  );
  return { onClose, onApplied, onRollback };
}

describe("RouteTemplateDialog", () => {
  beforeEach(() => {
    vi.mocked(api.previewRouteTemplate).mockResolvedValue(preview as never);
    vi.mocked(api.applyRouteTemplate).mockResolvedValue({
      ...preview,
      can_rollback: true,
    } as never);
  });

  it("confirm applies task_split for the current profile", async () => {
    const { onApplied } = setup();
    await waitFor(() => expect(api.previewRouteTemplate).toHaveBeenCalled());
    fireEvent.click(
      screen.getByRole("button", { name: /apply template|套用模板/i })
    );
    await waitFor(() => expect(api.applyRouteTemplate).toHaveBeenCalled());
    const input = vi.mocked(api.applyRouteTemplate).mock.calls[0][0];
    expect(input.template_id).toBe("task_split");
    expect(input.profile_id).toBe("r1");
    expect(onApplied).toHaveBeenCalled();
  });

  it("can switch to local+cloud template", async () => {
    setup();
    await waitFor(() => expect(api.previewRouteTemplate).toHaveBeenCalled());
    fireEvent.click(
      screen.getByRole("button", { name: /on-device \+ api|本机 \+ api/i })
    );
    await waitFor(() =>
      expect(api.previewRouteTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ template_id: "local_cloud" })
      )
    );
  });

  it("disables confirm when preview cannot apply", async () => {
    vi.mocked(api.previewRouteTemplate).mockResolvedValue({
      ...preview,
      can_apply: false,
      warnings: ["need_local_provider"],
      roles: [],
    } as never);
    setup();
    await waitFor(() => expect(api.previewRouteTemplate).toHaveBeenCalled());
    expect(
      screen.getByRole("button", { name: /apply template|套用模板/i })
    ).toBeDisabled();
  });
});
