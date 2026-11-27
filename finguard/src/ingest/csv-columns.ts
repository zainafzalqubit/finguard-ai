// CSV headers, shared by the sample generator (writes) and the parser (reads).
export const CSV_COLUMNS = {
  pos: ["po_number", "vendor_id", "amount", "currency"],
  payments: ["payment_id", "invoice_number", "vendor_id", "amount", "paid_on"],
  vendors: ["vendor_id", "name", "bank_account"],
} as const;

export type CsvKind = keyof typeof CSV_COLUMNS;
