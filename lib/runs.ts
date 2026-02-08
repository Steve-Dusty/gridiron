export interface Agent {
  role: "kinetic" | "contemplative" | "classical";
  status: "waiting" | "submitting" | "processing" | "downloading" | "done" | "failed";
  prompt: string | null;
  videoPath: string | null;
}

export interface RunState {
  id: string;
  prompt: string;
  status: string;
  error?: string;
  agents: Agent[];
}

// In-memory store for active generation runs
// Attach to globalThis so it survives Next.js dev-mode module reloads
const globalRuns = globalThis as typeof globalThis & {
  __gridion_runs?: Map<string, RunState>;
};

if (!globalRuns.__gridion_runs) {
  globalRuns.__gridion_runs = new Map<string, RunState>();
}

const runs = globalRuns.__gridion_runs;

export function getRun(runId: string): RunState | undefined {
  return runs.get(runId);
}

export function setRun(runId: string, state: RunState): void {
  runs.set(runId, state);
}
