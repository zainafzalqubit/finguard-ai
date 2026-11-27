// Synthetic sample data covering the 7 acceptance tests. Every vendor, account and amount is made up.
// Only type imports here, so the Node sample generator can load this file directly.
import type { Invoice, Payment, PurchaseOrder, Vendor } from "@/domain/types";

export const SAMPLE_VENDORS: Vendor[] = [
  { vendorId: "V-01", name: "Northwind Ltd", bankAccount: "6011 0022 1111" },
  { vendorId: "V-02", name: "Acme Supplies", bankAccount: "6011 0045 2290" },
  { vendorId: "V-03", name: "Bluefin Logistics", bankAccount: "6011 0071 4417" },
  { vendorId: "V-04", name: "Cedar Print Co", bankAccount: "6011 0093 5530" },
];

export const SAMPLE_POS: PurchaseOrder[] = [
  { poNumber: "PO-2001", vendorId: "V-01", amountCents: 400_000, currency: "USD" },
  { poNumber: "PO-2002", vendorId: "V-02", amountCents: 400_000, currency: "USD" },
  { poNumber: "PO-2003", vendorId: "V-03", amountCents: 500_000, currency: "USD" },
  { poNumber: "PO-2004", vendorId: "V-01", amountCents: 320_000, currency: "USD" },
  { poNumber: "PO-2005", vendorId: "V-04", amountCents: 215_000, currency: "USD" },
  { poNumber: "PO-2006", vendorId: "V-03", amountCents: 780_000, currency: "USD" },
  { poNumber: "PO-2007", vendorId: "V-04", amountCents: 96_000, currency: "USD" },
  { poNumber: "PO-2008", vendorId: "V-01", amountCents: 1_240_000, currency: "USD" },
];

export const SAMPLE_PAYMENTS: Payment[] = [
  { paymentId: "PAY-3001", invoiceNumber: "INV-1001", vendorId: "V-01", amountCents: 400_000, paidOn: "2026-10-20" },
  { paymentId: "PAY-3002", invoiceNumber: "INV-1002", vendorId: "V-02", amountCents: 500_000, paidOn: "2026-10-21" },
  { paymentId: "PAY-3003", invoiceNumber: "INV-1003", vendorId: "V-03", amountCents: 600_000, paidOn: "2026-10-22" },
  { paymentId: "PAY-3004", invoiceNumber: "INV-1004", vendorId: "V-02", amountCents: 320_000, paidOn: "2026-10-23" },
  { paymentId: "PAY-3006", invoiceNumber: "INV-1006", vendorId: "V-03", amountCents: 780_000, paidOn: "2026-10-25" },
  { paymentId: "PAY-3007", invoiceNumber: "INV-1007", vendorId: "V-04", amountCents: 96_000, paidOn: "2026-10-26" },
  { paymentId: "PAY-3008", invoiceNumber: "INV-1008", vendorId: "V-01", amountCents: 1_240_000, paidOn: "2026-10-27" },
];

type SampleInvoice = Invoice & { expect: string };

const invoice = (documentId: string, invoiceNumber: string, vendorName: string, poNumber: string, issueDate: string,
  subtotalCents: number, taxCents: number, bankAccount: string, expect: string): SampleInvoice => ({
  documentId, invoiceNumber, vendorName, poNumber, issueDate, subtotalCents, taxCents,
  totalCents: subtotalCents + taxCents, currency: "USD", bankAccount, expect,
});

/** `expect` documents which acceptance test each file exercises. */
export const SAMPLE_INVOICES: SampleInvoice[] = [
  invoice("inv-1001.pdf", "INV-1001", "Northwind Ltd", "PO-2001", "2026-10-01", 370_000, 30_000, "6011 0022 1111", "clean"),
  invoice("inv-1002.pdf", "INV-1002", "Acme Supplies", "PO-2002", "2026-10-02", 462_000, 38_000, "6011 0045 2290", "PO_AMOUNT_MISMATCH"),
  invoice("inv-1003.pdf", "INV-1003", "Bluefin Logistics", "PO-2003", "2026-10-03", 462_000, 38_000, "6011 0071 4417", "OVERPAYMENT"),
  invoice("inv-1004.pdf", "INV-1004", "Acme Supplies", "PO-2004", "2026-10-04", 296_000, 24_000, "6011 0045 2290", "VENDOR_MISMATCH"),
  invoice("inv-1005.pdf", "INV-1005", "Cedar Print Co", "PO-2005", "2026-10-05", 199_000, 16_000, "6011 0093 5530", "UNPAID_INVOICE"),
  invoice("inv-1006.pdf", "INV-1006", "Bluefin Logistics", "PO-2006", "2026-10-06", 722_000, 58_000, "6011 0071 9082", "BANK_DETAILS_CHANGED"),
  invoice("inv-1001-copy.pdf", "INV-1001", "Northwind Ltd", "PO-2001", "2026-10-01", 370_000, 30_000, "6011 0022 1111", "DUPLICATE_INVOICE"),
  invoice("inv-1007.pdf", "INV-1007", "Cedar Print Co", "PO-2007", "2026-10-07", 88_800, 7_200, "6011 0093 5530", "clean"),
  invoice("inv-1008.pdf", "INV-1008", "Northwind Ltd", "PO-2008", "2026-10-08", 1_148_000, 92_000, "6011 0022 1111", "clean"),
];

export const SAMPLE_CSV_FILES = { pos: "purchase-orders.csv", payments: "payments.csv", vendors: "vendors.csv" } as const;
