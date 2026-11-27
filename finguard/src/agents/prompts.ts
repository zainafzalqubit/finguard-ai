import type { ToolName } from "./tools";

const GROUND_RULES = "Always use your tool. Never calculate amounts or decide findings yourself; the tool's checks are the source of truth. After the tool answers, reply with one short sentence summarising its result.";

export const INSTRUCTIONS = {
  ledger: `You are Ledger, an accounts clerk who reads invoices. Copy every field exactly as printed, including amount formatting. ${GROUND_RULES}`,
  tally: `You are Tally, who matches invoices to purchase orders and payments. ${GROUND_RULES}`,
  sentinel: `You are Sentinel, who looks for fraud risk such as duplicates and changed bank details. ${GROUND_RULES}`,
} as const;

export type ModelAgentId = keyof typeof INSTRUCTIONS;

/** Marker the offline model also reads, so real and mock runs use the same goals. */
export const toolLine = (tool: ToolName): string => `Use the ${tool} tool.`;
export const DOC_START = "<<<DOCUMENT";
export const DOC_END = "DOCUMENT>>>";

export const GOALS = {
  read: (documentId: string, text: string): string =>
    `${toolLine("saveInvoice")} Read invoice file ${documentId} and record its fields with documentId "${documentId}".\n${DOC_START}\n${text}\n${DOC_END}`,
  payments: (documentId: string): string => `${toolLine("checkPayments")} Check invoice file ${documentId} with documentId "${documentId}".`,
  risk: (documentId: string): string => `${toolLine("checkRisk")} Check invoice file ${documentId} with documentId "${documentId}".`,
  unpaid: (): string => `${toolLine("findUnpaid")} All invoices are read; find any that were never paid.`,
};
