import type { AgentName } from "./domain.ts";
import type { AuditBus, StepEvent } from "./events.ts";

interface Span { agent: AgentName; label: string; start: number; end: number }

const WIDTH = 64;
const AGENTS: AgentName[] = ["Ledger", "Tally", "Sentinel"];

/** Records every step span from the bus so we can prove agents overlapped in time. */
export class TimelineRecorder {
  private readonly open = new Map<string, StepEvent>();
  private readonly spans: Span[] = [];

  constructor(bus: AuditBus) {
    bus.on("step.started", (e) => this.open.set(e.id, e));
    bus.on("step.finished", (e) => {
      const started = this.open.get(e.id);
      if (!started) return;
      this.open.delete(e.id);
      this.spans.push({ agent: e.agent, label: e.label, start: started.at, end: e.at });
    });
  }

  /** Highest number of different agents working at the same instant. */
  maxConcurrentAgents(): number {
    const points = this.spans.flatMap((s) => [s.start, s.end]);
    return Math.max(0, ...points.map((t) => new Set(this.spans.filter((s) => s.start <= t && t < s.end).map((s) => s.agent)).size));
  }

  render(): string {
    const total = Math.max(1, ...this.spans.map((s) => s.end));
    const rows = AGENTS.map((agent) => {
      const cells = Array.from({ length: WIDTH }, () => " ");
      // Tool calls take ~0ms, so draw them after inference spans or they get painted over.
      const own = this.spans.filter((s) => s.agent === agent).sort((a, b) => Number(a.label !== "thinking") - Number(b.label !== "thinking"));
      for (const span of own) {
        const from = Math.floor((span.start / total) * WIDTH);
        const to = Math.max(from + 1, Math.ceil((span.end / total) * WIDTH));
        for (let i = from; i < to && i < WIDTH; i++) cells[i] = span.label === "thinking" ? "░" : "█";
      }
      return `${agent.padEnd(9)}|${cells.join("")}|`;
    });
    return [...rows, `${" ".repeat(10)}0ms${" ".repeat(WIDTH - 8)}${Math.round(total)}ms`, "          ░ model inference   █ deterministic tool"].join("\n");
  }
}
