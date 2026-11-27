export type RunStatus = "running" | "completed" | "failed";

/** One saved audit as the history list shows it. */
export interface RunSummary {
  id: string;
  createdAt: number;
  status: RunStatus;
  model: string | null;
  invoices: number;
  findings: number;
}
