import { formatCents, maskAccount } from "@/domain/money";

import { DAY_MS, RULES_CONFIG } from "./config";
import { digitsOf, hit, vendorByName } from "./types";
import type { Rule } from "./types";

const sameText = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();
const daysApart = (a: string, b: string): number => Math.abs(Date.parse(a) - Date.parse(b)) / DAY_MS;

/** Same vendor and number as an earlier invoice, or same vendor and total within a few days. */
export const duplicateRule: Rule = (invoice, { earlier }) => {
  const twin = earlier.find((other) => sameText(other.vendorName, invoice.vendorName) && (
    sameText(other.invoiceNumber, invoice.invoiceNumber)
    || (other.totalCents === invoice.totalCents && daysApart(other.issueDate, invoice.issueDate) <= RULES_CONFIG.duplicateWindowDays)));
  if (!twin) return [];
  const sameNumber = sameText(twin.invoiceNumber, invoice.invoiceNumber);
  return [hit(invoice, {
    ruleId: "DUPLICATE_INVOICE", severity: "high", title: "Same invoice sent twice",
    explanation: `${invoice.documentId} matches ${twin.documentId}: same vendor, ${sameNumber ? "same invoice number" : "same total"} and ${formatCents(invoice.totalCents)}.`,
    evidence: [
      { source: invoice.documentId, field: sameNumber ? "Invoice number" : "Total", expected: "unique per vendor", found: sameNumber ? `${invoice.invoiceNumber} again` : formatCents(invoice.totalCents) },
      { source: twin.documentId, field: "Earlier copy", expected: "-", found: `${twin.invoiceNumber}, ${twin.issueDate}` },
    ],
  })];
};

/** Invoice bank account must match the vendor list. */
export const bankChangeRule: Rule = (invoice, { books }) => {
  const vendor = vendorByName(books, invoice.vendorName);
  if (!vendor || digitsOf(vendor.bankAccount) === digitsOf(invoice.bankAccount)) return [];
  return [hit(invoice, {
    ruleId: "BANK_DETAILS_CHANGED", severity: "high", title: "New bank account",
    explanation: `${invoice.invoiceNumber} asks for payment to an account the vendor list does not have for ${vendor.name}. Confirm with the vendor by phone before paying.`,
    evidence: [{ source: `${invoice.documentId} vs vendor ${vendor.vendorId}`, field: "Bank account", expected: maskAccount(digitsOf(vendor.bankAccount)), found: maskAccount(digitsOf(invoice.bankAccount)) }],
  })];
};

/** Subtotal plus tax must equal the total printed on the invoice. */
export const totalsRule: Rule = (invoice) => {
  const expected = invoice.subtotalCents + invoice.taxCents;
  if (expected === invoice.totalCents) return [];
  return [hit(invoice, {
    ruleId: "INVOICE_TOTALS_INVALID", severity: "medium", title: "Totals do not add up",
    explanation: `Subtotal ${formatCents(invoice.subtotalCents)} plus tax ${formatCents(invoice.taxCents)} is ${formatCents(expected)}, but the invoice says ${formatCents(invoice.totalCents)}.`,
    evidence: [{ source: invoice.documentId, field: "Total", expected: formatCents(expected), found: formatCents(invoice.totalCents) }],
  })];
};
