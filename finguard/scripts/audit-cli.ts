// Runs a full audit on data/samples in the terminal: `pnpm run audit:cli`.
// Uses the offline model unless .env.local sets ANTHROPIC_API_KEY or FINGUARD_MODEL.
import { runAudit } from "@/audit/run-audit";
import { createRun, subscribe } from "@/audit/run-store";
import { AGENTS } from "@/domain/agents";
import { loadUpload } from "@/ingest/load-upload";
import { readSampleFiles } from "@/samples/sample-files";
import type { RunEvent } from "@/domain/events";

const pad = (ms: number): string => `${(ms / 1000).toFixed(2)}s`.padStart(7);

function describe(event: RunEvent): string | null {
  switch (event.type) {
    case "run.started": return `run started with ${event.model}`;
    case "task.started": return `${AGENTS[event.agent].name.padEnd(8)} started ${event.label}`;
    case "tool.finished": return event.blocked ? `${AGENTS[event.agent].name.padEnd(8)} BLOCKED ${event.tool}` : null;
    case "finding.created": return `${"FINDING".padEnd(8)} ${event.finding.severity.toUpperCase()} ${event.finding.ruleId} on ${event.finding.documentId}`;
    case "agent.note": return event.text.startsWith("Failed") || event.text.startsWith("Blocked") || event.text.startsWith("Could not") ? `${AGENTS[event.agent].name.padEnd(8)} ${event.text}` : null;
    case "run.completed": return `run completed; passed: ${event.passed.join(", ")}`;
    case "run.failed": return `run FAILED: ${event.error}`;
    default: return null;
  }
}

/** Highest number of model agents with a task open at the same moment. */
function peakConcurrency(events: RunEvent[]): number {
  const open = new Map<string, string>();
  let peak = 0;
  for (const event of events) {
    if (event.type === "task.started") open.set(event.taskId, event.agent);
    if (event.type === "task.finished") open.delete(event.taskId);
    peak = Math.max(peak, new Set(open.values()).size);
  }
  return peak;
}

async function main(): Promise<void> {
  const input = await loadUpload(await readSampleFiles());
  const runId = createRun();
  const events: RunEvent[] = [];
  subscribe(runId, (event) => {
    events.push(event);
    const line = describe(event);
    if (line) console.log(`${pad(event.at)}  ${line}`);
  });
  await runAudit(runId, input);
  const findings = events.filter((e) => e.type === "finding.created").length;
  console.log(`\nFindings: ${findings}. Most agents working at once: ${peakConcurrency(events)} of 3.`);
}

main().catch((error: unknown) => {
  console.error("Audit failed:", error);
  process.exitCode = 1;
});
