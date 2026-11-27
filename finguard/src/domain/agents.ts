import type { AgentId } from "./types";

export interface AgentMeta {
  id: AgentId;
  name: string;
  role: string;
  group: string;
  icon: string;
  colorVar: string;
  usesModel: boolean;
}

/** One source of truth for agent identity, used by the server and the dashboard. */
export const AGENTS: Record<AgentId, AgentMeta> = {
  ledger: { id: "ledger", name: "Ledger", role: "Reads invoices", group: "Extraction", icon: "book-open-01", colorVar: "var(--a-ledger)", usesModel: true },
  tally: { id: "tally", name: "Tally", role: "Matches payments", group: "Matching", icon: "arrow-data-transfer-horizontal", colorVar: "var(--a-tally)", usesModel: true },
  sentinel: { id: "sentinel", name: "Sentinel", role: "Spots risk", group: "Risk", icon: "radar-01", colorVar: "var(--a-sentinel)", usesModel: true },
  rules: { id: "rules", name: "Rules", role: "Exact checks", group: "Deterministic", icon: "ruler", colorVar: "var(--a-engine)", usesModel: false },
};

export const AGENT_ORDER: AgentId[] = ["ledger", "tally", "sentinel", "rules"];
export const MODEL_AGENTS: AgentId[] = AGENT_ORDER.filter((id) => AGENTS[id].usesModel);
