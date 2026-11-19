// Core audit types shared by ingestion, rules, agents and UI. All amounts are integer cents.

export type AgentId = "ledger" | "tally" | "sentinel" | "rules";
export type Severity = "high" | "medium";
export type DocumentKind = "invoices" | "pos" | "payments" | "vendors";

export type RuleId =
  | "DUPLICATE_INVOICE"
  | "PO_AMOUNT_MISMATCH"
  | "OVERPAYMENT"
  | "UNPAID_INVOICE"
  | "VENDOR_MISMATCH"
  | "BANK_DETAILS_CHANGED"
  | "INVOICE_TOTALS_INVALID";

export interface Invoice {
  /** Source file name; unique per upload even when two files share an invoice number. */
  documentId: string;
  invoiceNumber: string;
  vendorName: string;
  poNumber: string;
  issueDate: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  bankAccount: string;
}

export interface PurchaseOrder {
  poNumber: string;
  vendorId: string;
  amountCents: number;
  currency: string;
}

export interface Payment {
  paymentId: string;
  invoiceNumber: string;
  vendorId: string;
  amountCents: number;
  paidOn: string;
}

export interface Vendor {
  vendorId: string;
  name: string;
  bankAccount: string;
}

/** Raw invoice document before extraction: the text Ledger reads. */
export interface InvoiceDocument {
  documentId: string;
  text: string;
}

export interface Evidence {
  source: string;
  field: string;
  expected: string;
  found: string;
}

export interface Finding {
  id: string;
  ruleId: RuleId;
  severity: Severity;
  documentId: string;
  invoiceNumber: string;
  raisedBy: AgentId;
  title: string;
  explanation: string;
  evidence: Evidence[];
}

/** Reference data the rules compare invoices against. */
export interface AuditBooks {
  purchaseOrders: PurchaseOrder[];
  payments: Payment[];
  vendors: Vendor[];
}
