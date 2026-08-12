import { describe, it, expect } from "vitest";
import {
  firstRequestCommandFor,
  firstRequestCommandsFor,
} from "./firstRequestCommands";

describe("firstRequestCommands", () => {
  it("maps known client ids and slugs", () => {
    expect(firstRequestCommandFor("codex")?.command).toBe("codex");
    expect(firstRequestCommandFor("claude_code")?.command).toBe("claude");
    expect(firstRequestCommandFor("claude-code")?.command).toBe("claude");
    expect(firstRequestCommandFor("gemini-cli")?.command).toBe("gemini");
    expect(firstRequestCommandFor("unknown")).toBeNull();
  });

  it("dedupes claude variants", () => {
    const cmds = firstRequestCommandsFor(["claude_code", "claude-code", "codex"]);
    expect(cmds.map((c) => c.command)).toEqual(["claude", "codex"]);
  });
});
