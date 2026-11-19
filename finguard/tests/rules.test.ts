import { describe, expect, it } from "vitest";

import { FINAL_RULES, PAYMENT_RULES, RISK_RULES, applyRules } from "@/rules";
import type { RuleHit } from "@/rules";
import { SAMPLE_INVOICES, SAMPLE_PAYMENTS, SAMPLE_POS, SAMPLE_VENDORS } from "@/samples/dataset";
import type { AuditBooks, Invoice } from "@/domain/types";

const books: AuditBooks = { purchaseOrders: SAMPLE_POS, payments: SAMPLE_PAYMENTS, vendors: SAMPLE_VENDORS };

/** Runs every rule the way the pipeline does: per invoice in order, then the final rules. */
function audit(invoices: Invoice[]): RuleHit[] {
  const hits = invoices.flatMap((invoice, index) => {
    const ctx = { books, earlier: invoices.slice(0, index) };
    return [...applyRules(PAYMENT_RULES, invoice, ctx), ...applyRules(RISK_RULES, invoice, ctx)];
  });
  const final = invoices.flatMap((invoice) => applyRules(FINAL_RULES, invoice, { books, earlier: [] }));
  return [...hits, ...final];
}

const hits = audit(SAMPLE_INVOICES);
const rulesFor = (documentId: string): string[] => hits.filter((h) => h.documentId === documentId).map((h) => h.ruleId).sort();

describe("acceptance tests on the sample data", () => {
  it.each([
    ["1. duplicate invoice", "inv-1001-copy.pdf", ["DUPLICATE_INVOICE"]],
    ["2. invoice $5,000 vs PO $4,000", "inv-1002.pdf", ["PO_AMOUNT_MISMATCH"]],
    ["3. payment $6,000 on a $5,000 invoice", "inv-1003.pdf", ["OVERPAYMENT"]],
    ["4. vendor differs from the PO", "inv-1004.pdf", ["VENDOR_MISMATCH"]],
    ["5. invoice never paid", "inv-1005.pdf", ["UNPAID_INVOICE"]],
    ["6. bank account changed", "inv-1006.pdf", ["BANK_DETAILS_CHANGED"]],
  ])("%s", (_name, documentId, expected) => {
    expect(rulesFor(documentId)).toEqual(expected);
  });

  it("7. clean invoices raise nothing (no false alarms)", () => {
    for (const documentId of ["inv-1001.pdf", "inv-1007.pdf", "inv-1008.pdf"]) expect(rulesFor(documentId)).toEqual([]);
  });

  it("raises exactly six findings in total", () => {
    expect(hits).toHaveLength(6);
  });

  it("gives every finding at least one evidence row", () => {
    for (const h of hits) expect(h.evidence.length).toBeGreaterThan(0);
  });

  it("states the overpayment with exact amounts", () => {
    const overpaid = hits.find((h) => h.ruleId === "OVERPAYMENT");
    expect(overpaid?.evidence[0]).toMatchObject({ expected: "$5,000.00", found: "$6,000.00" });
  });
});

describe("edge cases", () => {
  const base = SAMPLE_INVOICES[0];
  if (!base) throw new Error("sample data missing");

  it("flags totals that do not add up", () => {
    const broken = { ...base, documentId: "x.pdf", totalCents: base.totalCents + 1 };
    expect(applyRules(RISK_RULES, broken, { books, earlier: [] }).map((h) => h.ruleId)).toContain("INVOICE_TOTALS_INVALID");
  });

  it("catches a duplicate with a new number but the same vendor, total and near date", () => {
    const sneaky = { ...base, documentId: "y.pdf", invoiceNumber: "INV-9999", issueDate: "2026-10-03" };
    expect(applyRules(RISK_RULES, sneaky, { books, earlier: [base] }).map((h) => h.ruleId)).toContain("DUPLICATE_INVOICE");
  });

  it("compares bank accounts by digits, ignoring spaces", () => {
    const spaced = { ...base, bankAccount: "601100221111" };
    expect(applyRules(RISK_RULES, spaced, { books, earlier: [] })).toEqual([]);
  });
});
