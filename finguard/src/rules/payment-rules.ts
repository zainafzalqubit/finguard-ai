import { formatCents } from "@/domain/money";

import { RULES_CONFIG } from "./config";
import { hit, paymentsFor, poFor, vendorById, vendorByName } from "./types";
import type { Rule } from "./types";

/** Invoice total must match its purchase order. */
export const poAmountRule: Rule = (invoice, { books }) => {
  const po = poFor(books, invoice);
  if (!po || Math.abs(po.amountCents - invoice.totalCents) <= RULES_CONFIG.poToleranceCents) return [];
  const gap = formatCents(Math.abs(invoice.totalCents - po.amountCents));
  return [hit(invoice, {
    ruleId: "PO_AMOUNT_MISMATCH", severity: "medium", title: "Billed more than the PO",
    explanation: `${invoice.invoiceNumber} bills ${formatCents(invoice.totalCents)} against ${po.poNumber}, which approved ${formatCents(po.amountCents)}. The gap is ${gap}.`,
    evidence: [{ source: `${invoice.documentId} vs ${po.poNumber}`, field: "Invoice total", expected: formatCents(po.amountCents), found: formatCents(invoice.totalCents) }],
  })];
};

/** Payments for an invoice must not exceed its total. */
export const overpaymentRule: Rule = (invoice, { books }) => {
  const payments = paymentsFor(books, invoice);
  const paid = payments.reduce((sum, payment) => sum + payment.amountCents, 0);
  if (paid <= invoice.totalCents) return [];
  return [hit(invoice, {
    ruleId: "OVERPAYMENT", severity: "high", title: `Paid ${formatCents(paid - invoice.totalCents)} too much`,
    explanation: `${payments.map((p) => p.paymentId).join(", ")} paid ${formatCents(paid)} for ${invoice.invoiceNumber}, which totals ${formatCents(invoice.totalCents)}.`,
    evidence: [{ source: `payments.csv, ${payments.map((p) => p.paymentId).join(", ")}`, field: "Amount paid", expected: formatCents(invoice.totalCents), found: formatCents(paid) }],
  })];
};

/** The invoice's vendor must be the vendor the PO was issued to. */
export const vendorMismatchRule: Rule = (invoice, { books }) => {
  const po = poFor(books, invoice);
  if (!po) return [];
  const poVendor = vendorById(books, po.vendorId);
  const invoiceVendor = vendorByName(books, invoice.vendorName);
  if (invoiceVendor?.vendorId === po.vendorId) return [];
  const expected = poVendor?.name ?? po.vendorId;
  return [hit(invoice, {
    ruleId: "VENDOR_MISMATCH", severity: "high", title: "Wrong vendor on the PO",
    explanation: `${invoice.vendorName} sent ${invoice.invoiceNumber}, but ${po.poNumber} was issued to ${expected}.`,
    evidence: [{ source: `${invoice.documentId} vs ${po.poNumber}`, field: "Vendor", expected, found: invoice.vendorName }],
  })];
};

/** Run once all invoices are read: every invoice needs at least one payment. */
export const unpaidRule: Rule = (invoice, { books }) => {
  if (paymentsFor(books, invoice).length > 0) return [];
  return [hit(invoice, {
    ruleId: "UNPAID_INVOICE", severity: "medium", title: "Never paid",
    explanation: `No payment references ${invoice.invoiceNumber} (${formatCents(invoice.totalCents)}, ${invoice.vendorName}).`,
    evidence: [{ source: "payments.csv", field: "Payment", expected: `a row for ${invoice.invoiceNumber}`, found: "none" }],
  })];
};
