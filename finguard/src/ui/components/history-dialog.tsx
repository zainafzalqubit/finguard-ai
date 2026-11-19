"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, ReactElement } from "react";

import type { RunStatus, RunSummary } from "@/domain/run-summary";
import { plural, when } from "@/ui/format";
import { fetchRuns } from "@/ui/run/saved-runs";

import { Icon } from "./icon";
import { useModal } from "./use-modal";

interface HistoryDialogProps {
  open: boolean;
  currentRunId: string | null;
  onClose: () => void;
  onOpenRun: (runId: string) => void;
}

const STATUS: Record<RunStatus, { label: string; color: string }> = {
  completed: { label: "Complete", color: "var(--ok)" },
  running: { label: "Running", color: "var(--medium)" },
  failed: { label: "Stopped", color: "var(--high)" },
};

type ListState = { runs: RunSummary[] } | { error: string } | null;

/** Past audits, newest first; picking one replays it in the dashboard. */
export function HistoryDialog({ open, currentRunId, onClose, onOpenRun }: HistoryDialogProps): ReactElement {
  const dialogRef = useModal(open);
  const [list, setList] = useState<ListState>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    fetchRuns().then(
      (runs) => live && setList({ runs }),
      (error: unknown) => live && setList({ error: error instanceof Error ? error.message : "Could not load past audits." }),
    );
    return () => { live = false; };
  }, [open]);

  const pick = (runId: string): void => {
    onOpenRun(runId);
    onClose();
  };

  return (
    <dialog ref={dialogRef} className="sheet" aria-labelledby="history-title" onClose={onClose} onClick={(e) => e.target === dialogRef.current && onClose()}>
      <header className="sheet-head">
        <div><h2 id="history-title">Past audits</h2><p>Saved on this computer. Pick one to replay it.</p></div>
        <button className="key flat icon" aria-label="Close" onClick={onClose}><Icon name="cancel-01" /></button>
      </header>
      <div className="sheet-body" tabIndex={-1}>
        {list === null && <p className="history-empty">Loading…</p>}
        {list && "error" in list && <p className="history-empty error">{list.error}</p>}
        {list && "runs" in list && list.runs.length === 0 && <p className="history-empty">No audits yet. Start one with New audit.</p>}
        {list && "runs" in list && list.runs.length > 0 && (
          <ul className="history">
            {list.runs.map((run, i) => (
              <li key={run.id} style={{ "--i": i } as CSSProperties}>
                <button aria-current={run.id === currentRunId || undefined} onClick={() => pick(run.id)}>
                  <span className="history-led" style={{ "--led": STATUS[run.status].color } as CSSProperties} title={STATUS[run.status].label} />
                  <span className="grow">
                    <span className="name">{plural(run.invoices, "invoice")}, {plural(run.findings, "finding")}</span>
                    <span className="sub">{when(run.createdAt)}<span>{STATUS[run.status].label}{run.model ? `, ${run.model.split(":")[0]}` : ""}</span></span>
                  </span>
                  {run.id === currentRunId ? <span className="history-tag">Open</span> : <Icon name="arrow-right-01" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </dialog>
  );
}
