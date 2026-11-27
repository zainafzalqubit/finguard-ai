import { z } from "zod";

import { toCents } from "@/domain/money";
import type { Invoice } from "@/domain/types";

/**
 * What Ledger extracts from an invoice, exactly as printed. Amounts stay as text
 * ("$4,000.00") so the model never does arithmetic; code converts them to cents.
 */
export const INVOICE_FIELDS = z.object({
  invoiceNumber: z.string().min(1).describe("Invoice number, e.g. INV-1001"),
  vendorName: z.string().min(1).describe("Company that sent the invoice"),
  poNumber: z.string().min(1).describe("Purchase order number the invoice refers to, e.g. PO-2001"),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Invoice date as YYYY-MM-DD"),
  subtotal: z.string().min(1).describe("Subtotal exactly as printed"),
  tax: z.string().min(1).describe("Tax exactly as printed"),
  total: z.string().min(1).describe("Total due exactly as printed"),
  currency: z.string().length(3).describe("Three-letter currency code, e.g. USD"),
  bankAccount: z.string().min(4).describe("Bank account the vendor wants to be paid to"),
});

export type InvoiceFields = z.infer<typeof INVOICE_FIELDS>;

/** Tool argument schema: the extracted fields plus the document being read. */
export const SAVE_INVOICE_ARGS = INVOICE_FIELDS.extend({
  documentId: z.string().min(1).describe("File name of the invoice being read"),
});

/** Validates model output and converts it into a typed invoice. Throws with the first problem found. */
export function toInvoice(raw: unknown): Invoice {
  const result = SAVE_INVOICE_ARGS.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`Extraction rejected: ${issue?.path.join(".") ?? "fields"} ${issue?.message ?? "invalid"}`);
  }
  const f = result.data;
  return {
    documentId: f.documentId, invoiceNumber: f.invoiceNumber.trim(), vendorName: f.vendorName.trim(),
    poNumber: f.poNumber.trim(), issueDate: f.issueDate, currency: f.currency.toUpperCase(), bankAccount: f.bankAccount.trim(),
    subtotalCents: toCents(f.subtotal), taxCents: toCents(f.tax), totalCents: toCents(f.total),
  };
}
