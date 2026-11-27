import { z } from "zod";
import type { Tool, ToolDefinition } from "@mozaik-ai/core";

import { formatCents } from "@/domain/money";
import { SAVE_INVOICE_ARGS, toInvoice } from "@/ingest/invoice-fields";
import { FINAL_RULES, PAYMENT_RULES, RISK_RULES, applyRules } from "@/rules";
import type { Rule } from "@/rules";
import type { AgentId } from "@/domain/types";

import { currentRun } from "./run-context";

const DOCUMENT_ARGS = z.object({ documentId: z.string().min(1).describe("File name of the invoice to check") });
const NO_ARGS = z.object({});

/** zod -> JSON schema for the model; strict mode needs a closed object. */
function toolDefinition(name: string, description: string, schema: z.ZodObject): ToolDefinition {
  const parameters = { ...(z.toJSONSchema(schema) as Record<string, unknown>) };
  delete parameters["$schema"];
  return { name, description, parameters: { ...parameters, additionalProperties: false }, strict: true };
}

export const TOOL_DEFINITIONS = {
  saveInvoice: toolDefinition("saveInvoice", "Record the fields you read from an invoice. Copy amounts exactly as printed.", SAVE_INVOICE_ARGS),
  checkPayments: toolDefinition("checkPayments", "Compare an invoice with its purchase order and payments. Returns any problems found.", DOCUMENT_ARGS),
  findUnpaid: toolDefinition("findUnpaid", "After all invoices are read, find invoices with no payment.", NO_ARGS),
  checkRisk: toolDefinition("checkRisk", "Check an invoice for duplicates, changed bank details and totals that do not add up.", DOCUMENT_ARGS),
} satisfies Record<string, ToolDefinition>;

export type ToolName = keyof typeof TOOL_DEFINITIONS;

/** Runs a rule set for one document and stores the hits. The maths is all in the rules. */
function checkDocument(agent: AgentId, rules: Rule[], passed: (invoiceNumber: string) => string) {
  return (args: Record<string, unknown>): string => {
    const { documentId } = DOCUMENT_ARGS.parse(args);
    const { state } = currentRun();
    const invoice = state.invoice(documentId);
    if (!invoice) return `No extracted invoice for ${documentId}.`;
    const added = state.addHits(agent, applyRules(rules, invoice, { books: state.books, earlier: state.readBefore(documentId) }));
    return added.length ? `Flagged: ${added.map((f) => f.title).join("; ")}.` : passed(invoice.invoiceNumber);
  };
}

export const TOOLS: Record<ToolName, Tool> = {
  saveInvoice: {
    invoke: (args): string => {
      const invoice = toInvoice(args);
      currentRun().state.saveInvoice(invoice);
      return `Saved ${invoice.invoiceNumber} from ${invoice.vendorName}, total ${formatCents(invoice.totalCents)}.`;
    },
  },
  checkPayments: { invoke: checkDocument("tally", PAYMENT_RULES, (n) => `${n} matches its PO, vendor and payments.`) },
  checkRisk: { invoke: checkDocument("sentinel", RISK_RULES, (n) => `${n}: no duplicate, bank account on file, totals add up.`) },
  findUnpaid: {
    invoke: (): string => {
      const { state } = currentRun();
      const added = state.allInvoices().flatMap((invoice) => state.addHits("tally", applyRules(FINAL_RULES, invoice, { books: state.books, earlier: [] })));
      return added.length ? `Unpaid: ${added.map((f) => f.invoiceNumber).join(", ")}.` : "Every invoice has a payment.";
    },
  },
};
