import type { AuditBooks, Finding, Invoice, Payment, PurchaseOrder, Vendor } from "@/domain/types";

/** What a rule returns; the audit state adds the id and which agent raised it. */
export type RuleHit = Omit<Finding, "id" | "raisedBy">;

export interface RuleContext {
  books: AuditBooks;
  /** Invoices extracted before this one, in processing order (used for duplicates). */
  earlier: Invoice[];
}

export type Rule = (invoice: Invoice, ctx: RuleContext) => RuleHit[];

const normalise = (text: string): string => text.trim().toLowerCase();
export const digitsOf = (text: string): string => text.replace(/\D/g, "");

export function vendorByName(books: AuditBooks, name: string): Vendor | undefined {
  return books.vendors.find((vendor) => normalise(vendor.name) === normalise(name));
}

export function vendorById(books: AuditBooks, vendorId: string): Vendor | undefined {
  return books.vendors.find((vendor) => vendor.vendorId === vendorId);
}

export function poFor(books: AuditBooks, invoice: Invoice): PurchaseOrder | undefined {
  return books.purchaseOrders.find((po) => normalise(po.poNumber) === normalise(invoice.poNumber));
}

export function paymentsFor(books: AuditBooks, invoice: Invoice): Payment[] {
  return books.payments.filter((payment) => normalise(payment.invoiceNumber) === normalise(invoice.invoiceNumber));
}

/** Builds a hit with the fields every rule shares. */
export function hit(invoice: Invoice, fields: Pick<RuleHit, "ruleId" | "severity" | "title" | "explanation" | "evidence">): RuleHit {
  return { ...fields, documentId: invoice.documentId, invoiceNumber: invoice.invoiceNumber };
}
