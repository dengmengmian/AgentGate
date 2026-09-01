import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";

vi.mock("@/lib/api");
vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  writeText: vi.fn(),
}));

import * as api from "@/lib/api";
import { PostApplyDialog } from "./PostApplyDialog";

describe("PostApplyDialog", () => {
  beforeEach(() => {
    vi.mocked(api.killClientProcess).mockResolvedValue(undefined as never);
  });

  it("kills the listed process instead of only copying a command", async () => {
    render(
      <PostApplyDialog
        open
        clientId="deepseek_harness"
        clientName="DeepSeek Harness"
        configPath="/tmp/settings.yaml"
        processes={[{ pid: 58313, command: "dsh" }]}
        onClose={() => {}}
      />
    );

    const btn = screen.getByRole("button", { name: /tools.post_apply.kill/ });
    await act(async () => btn.click());

    await waitFor(() =>
      expect(api.killClientProcess).toHaveBeenCalledWith(
        "deepseek_harness",
        58313
      )
    );
  });
});
