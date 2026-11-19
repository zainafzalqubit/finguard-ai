import type { DocumentKind } from "./types";

export interface FileKind {
  key: DocumentKind;
  label: string;
  format: "PDF" | "CSV";
  hint: string;
  icon: string;
  match: (fileName: string) => boolean;
}

const isCsv = (name: string): boolean => /\.csv$/i.test(name);

/** Matching order matters: most specific CSV names first. Shared by the upload dialog and the server. */
export const FILE_KINDS: FileKind[] = [
  { key: "invoices", label: "Invoices", format: "PDF", hint: "PDF, one file per invoice", icon: "invoice-01", match: (n) => /\.pdf$/i.test(n) },
  { key: "payments", label: "Payments", format: "CSV", hint: "CSV export", icon: "bank", match: (n) => isCsv(n) && /pay/i.test(n) },
  { key: "vendors", label: "Vendor list", format: "CSV", hint: "CSV with bank details", icon: "user-group", match: (n) => isCsv(n) && /vendor|supplier/i.test(n) },
  { key: "pos", label: "Purchase orders", format: "CSV", hint: "CSV export", icon: "task-01", match: (n) => isCsv(n) && /(^|[^a-z])(po|pos|purchase)([^a-z]|$)/i.test(n) },
];

/** Display order, matching the sidebar. */
export const KIND_ORDER: DocumentKind[] = ["invoices", "pos", "payments", "vendors"];

export function kindOf(fileName: string): DocumentKind | null {
  return FILE_KINDS.find((kind) => kind.match(fileName))?.key ?? null;
}

export function kindMeta(key: DocumentKind): FileKind {
  const kind = FILE_KINDS.find((k) => k.key === key);
  if (!kind) throw new Error(`Unknown file kind ${key}`);
  return kind;
}

/** Extensions FinGuard can read at all. */
export const READABLE_FILE = /\.(pdf|csv)$/i;

export function fileProblem(fileName: string): string {
  if (!READABLE_FILE.test(fileName)) return "Only PDF and CSV files can be read";
  return "Rename it to include po, payments or vendors";
}
