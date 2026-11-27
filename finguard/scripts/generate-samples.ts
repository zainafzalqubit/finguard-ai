// Writes the synthetic sample PDFs and CSVs to data/samples. Run with `pnpm run samples`.
import { mkdir, writeFile } from "node:fs/promises";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { formatCents } from "@/domain/money";
import { toCsv } from "@/ingest/csv";
import { INVOICE_LABELS } from "@/ingest/invoice-layout";
import { SAMPLE_CSV_FILES, SAMPLE_INVOICES, SAMPLE_PAYMENTS, SAMPLE_POS, SAMPLE_VENDORS } from "@/samples/dataset";
import type { Invoice } from "@/domain/types";

const OUT_DIR = new URL("../data/samples/", import.meta.url);
const plain = (cents: number): string => (cents / 100).toFixed(2);

async function invoicePdf(invoice: Invoice): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${invoice.invoiceNumber} (synthetic sample)`);
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = 770;
  const line = (text: string, size = 11, face = font, gap = 22): void => {
    page.drawText(text, { x: 56, y, size, font: face, color: rgb(0.1, 0.1, 0.1) });
    y -= gap;
  };

  line(invoice.vendorName, 18, bold, 28);
  line("INVOICE", 12, bold, 34);
  line(`${INVOICE_LABELS.invoiceNumber}: ${invoice.invoiceNumber}`);
  line(`${INVOICE_LABELS.issueDate}: ${invoice.issueDate}`);
  line(`${INVOICE_LABELS.vendorName}: ${invoice.vendorName}`);
  line(`${INVOICE_LABELS.poNumber}: ${invoice.poNumber}`);
  line("Bill to: FinGuard Demo Co, 1 Sample Street", 11, font, 34);
  line("Services as agreed in the purchase order", 11, font, 34);
  line(`${INVOICE_LABELS.subtotal}: ${formatCents(invoice.subtotalCents)}`);
  line(`${INVOICE_LABELS.tax}: ${formatCents(invoice.taxCents)}`);
  line(`${INVOICE_LABELS.total}: ${formatCents(invoice.totalCents)}`, 12, bold);
  line(`${INVOICE_LABELS.currency}: ${invoice.currency}`, 11, font, 34);
  line(`${INVOICE_LABELS.bankAccount}: ${invoice.bankAccount}`);
  line("Synthetic sample for FinGuard AI. Not a real invoice.", 8, font);
  return pdf.save();
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  for (const invoice of SAMPLE_INVOICES) await writeFile(new URL(invoice.documentId, OUT_DIR), await invoicePdf(invoice));

  const csvFiles: Record<keyof typeof SAMPLE_CSV_FILES, string> = {
    pos: toCsv("pos", SAMPLE_POS.map((p) => ({ po_number: p.poNumber, vendor_id: p.vendorId, amount: plain(p.amountCents), currency: p.currency }))),
    payments: toCsv("payments", SAMPLE_PAYMENTS.map((p) => ({ payment_id: p.paymentId, invoice_number: p.invoiceNumber, vendor_id: p.vendorId, amount: plain(p.amountCents), paid_on: p.paidOn }))),
    vendors: toCsv("vendors", SAMPLE_VENDORS.map((v) => ({ vendor_id: v.vendorId, name: v.name, bank_account: v.bankAccount }))),
  };
  for (const [kind, content] of Object.entries(csvFiles)) {
    await writeFile(new URL(SAMPLE_CSV_FILES[kind as keyof typeof SAMPLE_CSV_FILES], OUT_DIR), `${content}\n`);
  }
  console.log(`Wrote ${SAMPLE_INVOICES.length} PDFs and ${Object.keys(csvFiles).length} CSVs to data/samples`);
}

main().catch((error: unknown) => {
  console.error("Sample generation failed:", error);
  process.exitCode = 1;
});
