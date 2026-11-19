import type { InvoiceFields } from "./invoice-fields";

/**
 * The printed labels on FinGuard sample invoices. The generator writes them and the offline
 * reader parses them, so both always agree. Real models read any layout; this is only for offline runs.
 */
export const INVOICE_LABELS: Record<keyof InvoiceFields, string> = {
  invoiceNumber: "Invoice number",
  vendorName: "From",
  poNumber: "PO number",
  issueDate: "Invoice date",
  subtotal: "Subtotal",
  tax: "Tax",
  total: "Total due",
  currency: "Currency",
  bankAccount: "Pay to account",
};

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Reads labelled fields from extracted PDF text. Returns null if any field is missing. */
export function readLabelledInvoice(text: string): InvoiceFields | null {
  const entries = Object.entries(INVOICE_LABELS).map(([key, label]) => {
    const match = text.match(new RegExp(`${escape(label)}\\s*:\\s*([^\\n]+?)\\s*(?:\\n|$)`, "i"));
    return [key, match?.[1]?.trim()] as const;
  });
  if (entries.some(([, value]) => !value)) return null;
  return Object.fromEntries(entries) as InvoiceFields;
}
