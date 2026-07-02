import type { TokenPilotProductCommandResult } from "@tokenpilot/host-adapter";
import {
  readCliContextState,
  updateCliContextState,
} from "./context-store.js";
import { CLI_HOSTS, parseCliHostId, type CliHostId } from "./hosts/registry.js";
import { createCliHostRuntime } from "./hosts/factory.js";
import { handleStandaloneVisualCommandWithSelection } from "./hosts/visual.js";
import { formatCliUsage } from "./usage.js";

type HostTarget = {
  host: CliHostId;
  sessionId?: string;
};

function parseBooleanContextCommand(args: string[]): boolean {
  return args.length === 1 && args[0] === "context";
}

async function resolveDefaultTarget(): Promise<HostTarget | undefined> {
  const state = await readCliContextState();
  const host = state.lastActiveHost;
  if (!host) return undefined;
  const sessionId = state.lastSessionByHost?.[host];
  return { host, sessionId };
}

async function resolveTarget(argv: string[]): Promise<{
  target?: HostTarget;
  commandArgs: string[];
  handledText?: string;
}> {
  if (parseBooleanContextCommand(argv)) {
    const state = await readCliContextState();
    const lines = [
      "LightMem2 CLI context:",
      `- lastActiveHost: ${state.lastActiveHost ?? "(unset)"}`,
      ...CLI_HOSTS.map((host) => `- ${host.hostId} session: ${state.lastSessionByHost?.[host.hostId] ?? "(unset)"}`),
      `- lastUpdatedAt: ${state.lastUpdatedAt ?? "(unset)"}`,
    ];
    return { commandArgs: [], handledText: lines.join("\n") };
  }

  if (argv[0] === "use") {
    const host = parseCliHostId(argv[1]);
    if (!host) {
      return { commandArgs: [], handledText: `Unknown host.\n\n${formatCliUsage()}` };
    }
    if (argv[2] === "session") {
      let sessionId = String(argv[3] ?? "").trim();
      if (!sessionId) {
        return { commandArgs: [], handledText: "Missing session id." };
      }
      const runtime = createCliHostRuntime({ host, sessionId });
      sessionId = (await runtime.resolveSessionId(sessionId)) ?? sessionId;
      await updateCliContextState({ host, sessionId });
      return { commandArgs: [], handledText: `Default context = ${host} / ${sessionId}` };
    }
    await updateCliContextState({ host });
    return { commandArgs: [], handledText: `Default host = ${host}` };
  }

  const explicitHost = parseCliHostId(argv[0]);
  if (explicitHost) {
    if (argv[1] === "session") {
      const sessionId = String(argv[2] ?? "").trim();
      const commandArgs = argv.slice(3);
      return {
        target: { host: explicitHost, sessionId: sessionId || undefined },
        commandArgs,
      };
    }
    return {
      target: { host: explicitHost },
      commandArgs: argv.slice(1),
    };
  }

  const defaultTarget = await resolveDefaultTarget();
  return {
    target: defaultTarget,
    commandArgs: argv,
  };
}

export async function dispatchCli(argv: string[]): Promise<TokenPilotProductCommandResult> {
  if (argv.length === 0 || argv[0] === "help" || argv[0] === "--help" || argv[0] === "-h") {
    return { text: formatCliUsage() };
  }

  const resolved = await resolveTarget(argv);
  if (resolved.handledText) {
    return { text: resolved.handledText };
  }

  const { target, commandArgs } = resolved;
  if (commandArgs.length === 1 && commandArgs[0] === "visual") {
    return handleStandaloneVisualCommandWithSelection({
      host: target?.host,
      sessionId: target?.sessionId,
    });
  }
  if (!target) {
    return {
      text: `No default host is selected.\n\n${formatCliUsage()}`,
    };
  }
  if (commandArgs.length === 0) {
    return {
      text: formatCliUsage(),
    };
  }

  const runtime = createCliHostRuntime({
    host: target.host,
    sessionId: target.sessionId,
  });
  const result = await runtime.handleCommand({
    args: commandArgs.join(" "),
    sessionId: target.sessionId,
  });

  const resolvedSessionId = target.sessionId
    ? await runtime.resolveSessionId(target.sessionId)
    : await runtime.maybeResolveLatestSessionId();
  await updateCliContextState({
    host: target.host,
    sessionId: resolvedSessionId,
  });
  return result;
}
