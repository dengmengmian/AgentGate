/**
 * Shortest terminal commands to verify a client is wired through MuxLayer.
 * Used by Quick Setup success state and Dashboard "ready for first request".
 */
export type FirstRequestCommand = {
  clientId: string;
  name: string;
  command: string;
};

const COMMAND_BY_ID: Record<string, { name: string; command: string }> = {
  codex: { name: "Codex", command: "codex" },
  claude_code: { name: "Claude Code", command: "claude" },
  "claude-code": { name: "Claude Code", command: "claude" },
  opencode: { name: "OpenCode", command: "opencode" },
  gemini: { name: "Gemini CLI", command: "gemini" },
  "gemini-cli": { name: "Gemini CLI", command: "gemini" },
  atomcode: { name: "AtomCode", command: "atomcode" },
};

/** Resolve a launch command for a client id or tool slug, if known. */
export function firstRequestCommandFor(
  clientIdOrSlug: string
): FirstRequestCommand | null {
  const hit = COMMAND_BY_ID[clientIdOrSlug];
  if (!hit) return null;
  return {
    clientId: clientIdOrSlug,
    name: hit.name,
    command: hit.command,
  };
}

export function firstRequestCommandsFor(
  ids: Iterable<string>
): FirstRequestCommand[] {
  const seen = new Set<string>();
  const out: FirstRequestCommand[] = [];
  for (const id of ids) {
    const cmd = firstRequestCommandFor(id);
    if (!cmd) continue;
    // Deduplicate by command text (claude_code vs claude-code).
    if (seen.has(cmd.command)) continue;
    seen.add(cmd.command);
    out.push(cmd);
  }
  return out;
}
