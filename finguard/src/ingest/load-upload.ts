import { FILE_KINDS, fileProblem, kindOf } from "@/domain/file-kinds";
import type { AuditBooks, DocumentKind, InvoiceDocument } from "@/domain/types";

import { parseCsv } from "./csv";
import { pdfToText } from "./pdf";

export interface UploadedFile {
  name: string;
  bytes: Uint8Array;
}

export interface AuditInput {
  documents: InvoiceDocument[];
  books: AuditBooks;
  counts: Record<DocumentKind, number>;
}

/** A problem the person can fix by changing their files; shown as-is in the dialog. */
export class UploadError extends Error {}

const decoder = new TextDecoder("utf-8");

/** Sorts files by kind, extracts PDF text and parses CSVs. Throws UploadError for anything the person must fix. */
export async function loadUpload(files: UploadedFile[]): Promise<AuditInput> {
  const unknown = files.filter((file) => !kindOf(file.name));
  if (unknown[0]) throw new UploadError(`${unknown[0].name}: ${fileProblem(unknown[0].name)}`);

  const byKind = (kind: DocumentKind): UploadedFile[] => files.filter((file) => kindOf(file.name) === kind);
  const missing = FILE_KINDS.filter((kind) => byKind(kind.key).length === 0);
  if (missing.length > 0) throw new UploadError(`Missing ${missing.map((k) => k.label.toLowerCase()).join(", ")}`);

  const csvRows = <K extends "pos" | "payments" | "vendors">(kind: K) =>
    byKind(kind).flatMap((file) => {
      try {
        return parseCsv(kind, file.name, decoder.decode(file.bytes));
      } catch (error) {
        throw new UploadError(error instanceof Error ? error.message : String(error));
      }
    });

  const documents = await Promise.all(byKind("invoices").map(async (file): Promise<InvoiceDocument> => {
    const text = await pdfToText(file.bytes);
    if (!text) throw new UploadError(`${file.name} has no readable text (scanned PDFs are not supported yet)`);
    return { documentId: file.name, text };
  }));

  const books: AuditBooks = { purchaseOrders: csvRows("pos"), payments: csvRows("payments"), vendors: csvRows("vendors") };
  // Sort by name without extension so "inv-1001" is read before "inv-1001-copy" (the copy is the duplicate).
  const stem = (id: string): string => id.replace(/\.[^.]+$/, "");
  return {
    documents: documents.sort((a, b) => stem(a.documentId).localeCompare(stem(b.documentId), "en", { numeric: true })),
    books,
    counts: { invoices: documents.length, pos: books.purchaseOrders.length, payments: books.payments.length, vendors: books.vendors.length },
  };
}
