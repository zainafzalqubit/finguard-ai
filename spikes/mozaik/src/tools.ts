import { RAW_INVOICES, money } from "./domain.ts";
import type { AuditState } from "./state.ts";
import type { Tool, ToolDefinition } from "@mozaik-ai/core";

/** Every tool takes one invoice number; the maths inside is plain deterministic code. */
const invoiceArg = (description: string): Record<string, unknown> => ({
  type: "object",
  properties: { invoiceNumber: { type: "string", description } },
  required: ["invoiceNumber"],
  additionalProperties: false,
});

export const TOOL_DEFINITIONS = {
  extractInvoice: { name: "extractInvoice", description: "Read an invoice document and save its fields.", parameters: invoiceArg("Invoice to read, e.g. INV-1001"), strict: true },
  matchPayments: { name: "matchPayments", description: "Compare an invoice with its purchase order and payments.", parameters: invoiceArg("Invoice to match"), strict: true },
  checkBankDetails: { name: "checkBankDetails", description: "Compare the invoice bank account with the vendor list.", parameters: invoiceArg("Invoice to check"), strict: true },
} satisfies Record<string, ToolDefinition>;

export type ToolName = keyof typeof TOOL_DEFINITIONS;

function invoiceNumberOf(args: Record<string, unknown>): string {
  const value = args["invoiceNumber"];
  if (typeof value !== "string") throw new Error("invoiceNumber must be a string");
  return value;
}

export function createTools(state: AuditState): Record<ToolName, Tool> {
  return {
    extractInvoice: {
      invoke: (args): string => {
        const raw = RAW_INVOICES[invoiceNumberOf(args)];
        if (!raw) return "No such invoice document.";
        state.saveInvoice(raw);
        return JSON.stringify(raw);
      },
    },
    matchPayments: {
      invoke: (args): string => {
        const invoice = state.requireInvoice(invoiceNumberOf(args));
        const po = state.purchaseOrders.find((p) => p.poNumber === invoice.poNumber);
        const paid = state.payments.filter((p) => p.invoiceNumber === invoice.invoiceNumber).reduce((sum, p) => sum + p.amountCents, 0);
        const notes: string[] = [];
        if (po && po.amountCents !== invoice.totalCents) {
          state.addFinding({ ruleId: "PO_AMOUNT_MISMATCH", severity: "medium", invoiceNumber: invoice.invoiceNumber, raisedBy: "Tally",
            evidence: [{ documentId: invoice.poNumber, field: "amount", expected: money(po.amountCents), found: money(invoice.totalCents) }] });
          notes.push("total differs from PO");
        }
        if (paid > invoice.totalCents) {
          state.addFinding({ ruleId: "OVERPAYMENT", severity: "high", invoiceNumber: invoice.invoiceNumber, raisedBy: "Tally",
            evidence: [{ documentId: "payments.csv", field: "amount", expected: money(invoice.totalCents), found: money(paid) }] });
          notes.push(`overpaid by ${money(paid - invoice.totalCents)}`);
        }
        return notes.length ? `Flagged: ${notes.join(", ")}.` : "PO and payments match.";
      },
    },
    checkBankDetails: {
      invoke: (args): string => {
        const invoice = state.requireInvoice(invoiceNumberOf(args));
        const vendor = state.vendors.find((v) => v.vendorId === invoice.vendorId);
        if (!vendor || vendor.bankAccount === invoice.bankAccount) return "Bank account matches the vendor list.";
        state.addFinding({ ruleId: "BANK_DETAILS_CHANGED", severity: "high", invoiceNumber: invoice.invoiceNumber, raisedBy: "Sentinel",
          evidence: [{ documentId: `vendors.csv ${vendor.vendorId}`, field: "bankAccount", expected: `ending ${vendor.bankAccount}`, found: `ending ${invoice.bankAccount}` }] });
        return `Flagged: bank account ending ${invoice.bankAccount} is not on file for ${vendor.name}.`;
      },
    },
  };
}
