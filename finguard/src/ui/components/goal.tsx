import type { ReactElement } from "react";

import { MODEL_AGENTS } from "@/domain/agents";
import { clock, plural } from "@/ui/format";
import { invoiceDocuments, slipState, workingCount } from "@/ui/run/derive";
import type { RunView } from "@/ui/run/run-view";

function goalText(view: RunView): string {
  if (!view.counts) return view.status === "starting" ? "Reading your files…" : "Upload invoices, purchase orders, payments and the vendor list to start an audit.";
  const { invoices, pos, payments } = view.counts;
  return `Check ${plural(invoices, "invoice")} against ${plural(pos, "purchase order")}, ${plural(payments, "payment")} and the vendor list.`;
}

function metaText(view: RunView): [string, string] {
  if (view.status === "completed" && view.endAt !== null) return [`Finished in ${clock(view.endAt)}`, plural(view.findings.length, "finding")];
  if (view.status === "failed") return ["Stopped", view.error ?? "The audit failed"];
  if (!view.counts) return ["", ""];
  // Every invoice gets three agent tasks (read, match, risk), plus one unpaid check at the end.
  const total = view.counts.invoices * MODEL_AGENTS.length + 1;
  const done = view.tasks.filter((t) => t.end !== null).length;
  return [`Step ${done} of ${total}`, `${workingCount(view)} of ${MODEL_AGENTS.length} agents working`];
}

export function Goal({ view }: { view: RunView }): ReactElement {
  const [step, working] = metaText(view);
  const read = invoiceDocuments(view);
  const slots = Math.max(view.counts?.invoices ?? 0, read.length);
  return (
    <div className="goal">
      <div>
        <p>{goalText(view)}</p>
        {step && <div className="meta"><span>{step}</span><span>{working}</span></div>}
      </div>
      {slots > 0 && (
        <div className="slips" aria-label="Invoice status">
          {Array.from({ length: slots }, (_, i) => {
            const documentId = read[i];
            return <i key={documentId ?? `slot-${i}`} className={documentId ? slipState(view, documentId) : ""} title={documentId ?? "Not read yet"} />;
          })}
        </div>
      )}
    </div>
  );
}
