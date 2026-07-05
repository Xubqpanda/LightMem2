import { readFile } from "node:fs/promises";
import { readCliHostPathOverrides } from "../context-store.js";
import type { VisualHostSource } from "@tokenpilot/product-surface";
import {
  defaultTokenPilotClaudeCodeConfigPath,
  loadTokenPilotClaudeCodeConfig,
} from "../../../../adapters/claude-code/src/config.js";
import {
  defaultTokenPilotConfigPath,
  loadTokenPilotCodexConfig,
} from "../../../../adapters/codex/src/config.js";
import { resolveOpenClawConfigPath } from "../../../../adapters/openclaw/src/context-stack/integration/openclaw-paths.js";
import { resolveStateDir as resolveOpenClawStateDir } from "../../../../adapters/openclaw/src/commands/tokenpilot/host-config-adapter.js";

export const CLI_HOSTS = [
  {
    hostId: "openclaw",
    displayName: "OpenClaw",
  },
  {
    hostId: "codex",
    displayName: "Codex",
  },
  {
    hostId: "claude-code",
    displayName: "Claude Code",
  },
] as const;

export type CliHostId = (typeof CLI_HOSTS)[number]["hostId"];

type CliVisualHostDefinition = {
  hostId: CliHostId;
  displayName: string;
  resolveStateDir(): Promise<string | undefined>;
};

export function parseCliHostId(value: string | undefined): CliHostId | undefined {
  const normalized = typeof value === "string" ? value.trim() : "";
  for (const host of CLI_HOSTS) {
    if (host.hostId === normalized) return host.hostId;
  }
  return undefined;
}

async function resolveCodexTokenPilotConfigPath(): Promise<string> {
  return (
    process.env.TOKENPILOT_CODEX_CONFIG?.trim()
    || (await readCliHostPathOverrides("codex"))?.tokenPilotConfigPath?.trim()
    || defaultTokenPilotConfigPath()
  );
}

async function resolveClaudeCodeTokenPilotConfigPath(): Promise<string> {
  return (
    process.env.TOKENPILOT_CLAUDE_CODE_CONFIG?.trim()
    || (await readCliHostPathOverrides("claude-code"))?.tokenPilotConfigPath?.trim()
    || defaultTokenPilotClaudeCodeConfigPath()
  );
}

async function readOpenClawConfig(): Promise<Record<string, unknown>> {
  const configPath = resolveOpenClawConfigPath();
  try {
    const raw = await readFile(configPath, "utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const CLI_VISUAL_HOST_DEFINITIONS: CliVisualHostDefinition[] = [
  {
    hostId: "openclaw",
    displayName: "OpenClaw",
    async resolveStateDir(): Promise<string | undefined> {
      const openclawConfig = await readOpenClawConfig();
      return resolveOpenClawStateDir(openclawConfig);
    },
  },
  {
    hostId: "codex",
    displayName: "Codex",
    async resolveStateDir(): Promise<string | undefined> {
      const codexConfig = await loadTokenPilotCodexConfig(await resolveCodexTokenPilotConfigPath());
      return typeof codexConfig.stateDir === "string" ? codexConfig.stateDir : undefined;
    },
  },
  {
    hostId: "claude-code",
    displayName: "Claude Code",
    async resolveStateDir(): Promise<string | undefined> {
      const claudeConfig = await loadTokenPilotClaudeCodeConfig(await resolveClaudeCodeTokenPilotConfigPath());
      return typeof claudeConfig.stateDir === "string" ? claudeConfig.stateDir : undefined;
    },
  },
];

export async function resolveCliVisualHosts(): Promise<VisualHostSource[]> {
  const hosts: VisualHostSource[] = [];
  for (const definition of CLI_VISUAL_HOST_DEFINITIONS) {
    const stateDir = String((await definition.resolveStateDir()) ?? "").trim();
    if (!stateDir) continue;
    hosts.push({
      hostId: definition.hostId,
      displayName: definition.displayName,
      stateDir,
    });
  }
  return hosts;
}
