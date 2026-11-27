import Papa from "papaparse";
import { z } from "zod";

import { toCents } from "@/domain/money";
import type { Payment, PurchaseOrder, Vendor } from "@/domain/types";

import { CSV_COLUMNS } from "./csv-columns";
import type { CsvKind } from "./csv-columns";

const text = z.string().trim().min(1);
const amount = text.transform((value, ctx) => {
  try {
    return toCents(value);
  } catch {
    ctx.addIssue({ code: "custom", message: `"${value}" is not an amount` });
    return z.NEVER;
  }
});

const ROW_SCHEMAS = {
  pos: z.object({ po_number: text, vendor_id: text, amount, currency: text.default("USD") })
    .transform((r): PurchaseOrder => ({ poNumber: r.po_number, vendorId: r.vendor_id, amountCents: r.amount, currency: r.currency })),
  payments: z.object({ payment_id: text, invoice_number: text, vendor_id: text, amount, paid_on: text })
    .transform((r): Payment => ({ paymentId: r.payment_id, invoiceNumber: r.invoice_number, vendorId: r.vendor_id, amountCents: r.amount, paidOn: r.paid_on })),
  vendors: z.object({ vendor_id: text, name: text, bank_account: text })
    .transform((r): Vendor => ({ vendorId: r.vendor_id, name: r.name, bankAccount: r.bank_account })),
};

type RowOf<K extends CsvKind> = z.output<(typeof ROW_SCHEMAS)[K]>;

/** Parses one CSV file. Throws a readable error naming the file, row and column that failed. */
export function parseCsv<K extends CsvKind>(kind: K, fileName: string, content: string): RowOf<K>[] {
  const parsed = Papa.parse<Record<string, string>>(content.trim(), { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim().toLowerCase() });
  const missing = CSV_COLUMNS[kind].filter((column) => !parsed.meta.fields?.includes(column) && column !== "currency");
  if (missing.length > 0) throw new Error(`${fileName} is missing column ${missing.join(", ")}`);

  return parsed.data.map((row, index) => {
    const result = ROW_SCHEMAS[kind].safeParse(row);
    if (!result.success) {
      const issue = result.error.issues[0];
      throw new Error(`${fileName}, row ${index + 2}: ${issue?.path.join(".") ?? "row"} ${issue?.message ?? "is invalid"}`);
    }
    return result.data as RowOf<K>;
  });
}

/** Turns rows back into CSV text (used by the sample generator). */
export function toCsv(kind: CsvKind, rows: Record<string, string>[]): string {
  return Papa.unparse({ fields: [...CSV_COLUMNS[kind]], data: rows.map((row) => CSV_COLUMNS[kind].map((c) => row[c] ?? "")) });
}
