import { PAYMENTS, PURCHASE_ORDERS, VENDORS } from "./domain.ts";
import type { Finding, Invoice, Payment, PurchaseOrder, Vendor } from "./domain.ts";

/**
 * Shared audit state every agent reads and writes through its tools.
 * Mozaik 5 has no built-in shared state, so the app owns it (one object per audit run).
 */
export class AuditState {
  readonly invoices = new Map<string, Invoice>();
  readonly findings: Finding[] = [];
  readonly purchaseOrders: readonly PurchaseOrder[] = PURCHASE_ORDERS;
  readonly payments: readonly Payment[] = PAYMENTS;
  readonly vendors: readonly Vendor[] = VENDORS;

  saveInvoice(invoice: Invoice): void {
    this.invoices.set(invoice.invoiceNumber, invoice);
  }

  requireInvoice(invoiceNumber: string): Invoice {
    const invoice = this.invoices.get(invoiceNumber);
    if (!invoice) throw new Error(`Invoice ${invoiceNumber} has not been extracted yet`);
    return invoice;
  }

  addFinding(finding: Finding): void {
    // A finding without evidence is never stored: no proof, no finding.
    if (finding.evidence.length === 0) throw new Error(`Finding ${finding.ruleId} has no evidence`);
    this.findings.push(finding);
  }
}
