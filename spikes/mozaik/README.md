# Mozaik spike (prep, throwaway)

Proves the FinGuard agent pattern on `@mozaik-ai/core@5.0.1` before the build starts.
This folder is not part of the submission.

## Run

```bash
pnpm install
pnpm run spike        # offline, uses a mock model, no API key needed
pnpm run typecheck
```

Real model: copy `.env.example` to `.env`, set `MODEL=claude-haiku-4-5` and `ANTHROPIC_API_KEY`, then `pnpm run spike`.

## What it proves

- Three Mozaik agents (Ledger, Tally, Sentinel) run at the same time: the output reports "3 of 3" agents working at once and draws the timeline.
- Pipeline: when Ledger finishes an invoice, Tally and Sentinel start on it while Ledger moves to the next one.
- Shared state: all tools read and write one `AuditState` object.
- Events: a typed bus (`step.started`, `step.finished`, `invoice.extracted`, `tool.blocked`) that will feed the dashboard over SSE.
- Code decides: every amount and flag comes from deterministic tools; the model only decides which tool to call.
- Breakpoint policy: every tool call is inspected before it runs, and an agent can only call its own tool.

## What we learned about Mozaik 5

- 5.0.0 (14 Nov 2026) rewrote the package. The docs site still shows the 4.2 multi-agent runtime (`defineRuntime`, `RuntimeState`, `runLoop`), which 5.x no longer exports.
- 5.x is an interruptible single-agent harness: `initAgentModule`, `createAgent`, `registerTool`, `createLoop`, `setBreakpoint`, `advanceLoop`, `getLoop`, `endLoop`.
- The app drives each Loop one instruction at a time (inference or tool call), so concurrency, shared state and events are ours to build, as done here.
- Custom models plug in through `inferenceRunnerConfig.supportedModels`, which is how the offline mock works.
- The agent `instruction` is not sent automatically; the driver adds it as a `system_message`.

## Files

| File | Job |
| --- | --- |
| `src/main.ts` | Wires agents, the pipeline and the report |
| `src/run-agent.ts` | Drives one Loop through its breakpoints |
| `src/tools.ts` | Deterministic tools and their JSON schemas |
| `src/state.ts` | Shared audit state |
| `src/events.ts` | Typed event bus |
| `src/timeline.ts` | Records spans and proves overlap |
| `src/mock-model.ts` | Offline model for runs without an API key |
| `src/domain.ts` | Types and synthetic fixtures |
