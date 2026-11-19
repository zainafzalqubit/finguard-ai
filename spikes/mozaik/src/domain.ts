// Domain types and synthetic fixtures. Amounts are integer cents to avoid float errors.

export type AgentName = "Ledger" | "Tally" | "Sentinel";
export type Severity = "high" | "medium";
export type RuleId = "OVERPAYMENT" | "PO_AMOUNT_MISMATCH" | "BANK_DETAILS_CHANGED";

export interface Invoice {
  invoiceNumber: string;
  vendorId: string;
  poNumber: string;
  totalCents: number;
  bankAccount: string;
}

export interface PurchaseOrder { poNumber: string; vendorId: string; amountCents: number }
export interface Payment { paymentId: string; invoiceNumber: string; amountCents: number }
export interface Vendor { vendorId: string; name: string; bankAccount: string }

export interface Evidence {
  documentId: string;
  field: string;
  expected: string;
  found: string;
}

export interface Finding {
  ruleId: RuleId;
  severity: Severity;
  invoiceNumber: string;
  raisedBy: AgentName;
  evidence: Evidence[];
}

/** Stands in for PDF text. In the real build, Ledger reads this from the uploaded PDF. */
export const RAW_INVOICES: Record<string, Invoice> = {
  "INV-1001": { invoiceNumber: "INV-1001", vendorId: "V-01", poNumber: "PO-2001", totalCents: 400_000, bankAccount: "1111" },
  "INV-1003": { invoiceNumber: "INV-1003", vendorId: "V-03", poNumber: "PO-2003", totalCents: 500_000, bankAccount: "4417" },
  "INV-1006": { invoiceNumber: "INV-1006", vendorId: "V-03", poNumber: "PO-2006", totalCents: 780_000, bankAccount: "9082" },
};

export const PURCHASE_ORDERS: PurchaseOrder[] = [
  { poNumber: "PO-2001", vendorId: "V-01", amountCents: 400_000 },
  { poNumber: "PO-2003", vendorId: "V-03", amountCents: 500_000 },
  { poNumber: "PO-2006", vendorId: "V-03", amountCents: 780_000 },
];

export const PAYMENTS: Payment[] = [
  { paymentId: "PAY-3001", invoiceNumber: "INV-1001", amountCents: 400_000 },
  { paymentId: "PAY-3003", invoiceNumber: "INV-1003", amountCents: 600_000 },
  { paymentId: "PAY-3006", invoiceNumber: "INV-1006", amountCents: 780_000 },
];

export const VENDORS: Vendor[] = [
  { vendorId: "V-01", name: "Northwind Ltd", bankAccount: "1111" },
  { vendorId: "V-03", name: "Bluefin Logistics", bankAccount: "4417" },
];

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export const money = (cents: number): string => USD.format(cents / 100);
