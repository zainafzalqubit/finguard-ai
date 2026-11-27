import type { AgentId, AuditBooks, Finding, Invoice } from "@/domain/types";
import type { RuleHit } from "@/rules";

/** Shared state for one audit run. Every agent reads and writes it through its tools. */
export class AuditState {
  private readonly invoices: Invoice[] = [];
  private readonly findings = new Map<string, Finding>();
  readonly books: AuditBooks;
  private readonly onFinding: (finding: Finding) => void;

  // Plain fields, not parameter properties, so Node's type stripping can run this file in scripts.
  constructor(books: AuditBooks, onFinding: (finding: Finding) => void) {
    this.books = books;
    this.onFinding = onFinding;
  }

  saveInvoice(invoice: Invoice): void {
    const index = this.invoices.findIndex((i) => i.documentId === invoice.documentId);
    if (index >= 0) this.invoices[index] = invoice;
    else this.invoices.push(invoice);
  }

  invoice(documentId: string): Invoice | undefined {
    return this.invoices.find((i) => i.documentId === documentId);
  }

  /** Invoices read before this document, in reading order. */
  readBefore(documentId: string): Invoice[] {
    const index = this.invoices.findIndex((i) => i.documentId === documentId);
    return index < 0 ? [...this.invoices] : this.invoices.slice(0, index);
  }

  allInvoices(): Invoice[] {
    return [...this.invoices];
  }

  /** Stores rule hits as findings. One finding per rule per document; no evidence, no finding. */
  addHits(raisedBy: AgentId, hits: RuleHit[]): Finding[] {
    const added: Finding[] = [];
    for (const ruleHit of hits) {
      const id = `${ruleHit.ruleId}:${ruleHit.documentId}`;
      if (this.findings.has(id)) continue;
      if (ruleHit.evidence.length === 0) throw new Error(`${ruleHit.ruleId} has no evidence`);
      const finding: Finding = { ...ruleHit, id, raisedBy };
      this.findings.set(id, finding);
      added.push(finding);
      this.onFinding(finding);
    }
    return added;
  }

  /** Findings this agent raised on this document (any document when null). Safe while other agents run in parallel. */
  findingsBy(agent: AgentId, documentId: string | null): number {
    return [...this.findings.values()].filter((f) => f.raisedBy === agent && (documentId === null || f.documentId === documentId)).length;
  }

  hasFindings(documentId: string): boolean {
    return [...this.findings.values()].some((f) => f.documentId === documentId);
  }
}
