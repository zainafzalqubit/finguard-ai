import { describe, expect, it } from "vitest";

import type { Finding } from "@/domain/types";
import { incompleteDocuments, passedDocuments } from "@/ui/run/derive";
import { EMPTY_RUN } from "@/ui/run/run-view";

const duplicate = { id: "f1", documentId: "inv-1001-copy.pdf", invoiceNumber: "INV-1001" } as Finding;

describe("outcome chips", () => {
  it("opens the passed file, not a flagged copy with the same invoice number", () => {
    const view = { ...EMPTY_RUN, extracted: { "inv-1001.pdf": "INV-1001", "inv-1001-copy.pdf": "INV-1001" }, findings: [duplicate], passed: ["INV-1001"] };
    expect(passedDocuments(view)).toEqual([{ label: "INV-1001", documentId: "inv-1001.pdf" }]);
  });

  it("leaves a chip without a file when the number was never read", () => {
    expect(passedDocuments({ ...EMPTY_RUN, passed: ["INV-9"] })).toEqual([{ label: "INV-9", documentId: null }]);
  });

  it("labels unfinished files by invoice number when known", () => {
    const view = { ...EMPTY_RUN, extracted: { "inv-1002.pdf": "INV-1002" }, incomplete: ["inv-1002.pdf", "inv-1003.pdf"] };
    expect(incompleteDocuments(view)).toEqual([{ label: "INV-1002", documentId: "inv-1002.pdf" }, { label: "inv-1003.pdf", documentId: "inv-1003.pdf" }]);
  });
});
