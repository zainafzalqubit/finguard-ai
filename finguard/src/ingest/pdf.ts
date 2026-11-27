import { extractText, getDocumentProxy } from "unpdf";

/** Pulls plain text out of a PDF so Ledger can read it. Scanned (image-only) PDFs come back empty. */
export async function pdfToText(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: true });
  return text.trim();
}
