"use client";

import { useEffect, useState } from "react";
import type { ReactElement } from "react";

import type { Severity } from "@/domain/types";
import { plural } from "@/ui/format";
import type { RunView } from "@/ui/run/run-view";

import { FindingItem } from "./finding-item";
import { Icon } from "./icon";

type Filter = "all" | Severity;
const FILTERS: { key: Filter; label: string }[] = [{ key: "all", label: "All" }, { key: "high", label: "High" }, { key: "medium", label: "Medium" }];

interface PanelProps {
  view: RunView;
  /** Bumped by the timeline or activity feed to open a finding; the nonce lets the same finding reopen. */
  focus: { id: string; nonce: number } | null;
}

const toggled = (set: Set<string>, id: string): Set<string> => {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
};

interface OutcomeProps { icon: string; title: string; refs: string[]; note?: string; warn?: boolean }

function Outcome({ icon, title, refs, note, warn = false }: OutcomeProps): ReactElement {
  return (
    <div className={`passed ${warn ? "warn" : ""}`.trim()}>
      <span className="sev-icon"><Icon name={icon} /></span>
      <div>
        <strong>{title}</strong>
        {note && <div>{note}</div>}
        <div className="refs">{refs.map((ref, i) => <span key={`${ref}-${i}`}>{ref}</span>)}</div>
      </div>
    </div>
  );
}

/** Keyed by run id in the dashboard, so a new run starts with a clean panel. */
export function FindingsPanel({ view, focus }: PanelProps): ReactElement {
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());

  const [seenFocus, setSeenFocus] = useState(focus);

  // Open the focused finding when the request changes (React's "adjust state on prop change" pattern).
  if (focus !== seenFocus) {
    setSeenFocus(focus);
    if (focus) {
      setFilter("all");
      setOpen((current) => new Set(current).add(focus.id));
    }
  }

  useEffect(() => {
    if (!focus) return;
    const frame = requestAnimationFrame(() => document.getElementById(`finding-${focus.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
    return () => cancelAnimationFrame(frame);
  }, [focus]);

  const count = (key: Filter): number => view.findings.filter((f) => key === "all" || f.severity === key).length;
  const shown = view.findings.filter((f) => filter === "all" || f.severity === filter);

  return (
    <aside className="panel" aria-label="Findings">
      <div className="panel-head">
        <div className="panel-title"><h2>Findings</h2><span className="pill">{view.findings.length}</span></div>
        <div className="seg">
          {FILTERS.map(({ key, label }) => (
            <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label} <span className="n">{count(key)}</span></button>
          ))}
        </div>
      </div>
      <div className="list">
        {shown.length === 0 && (
          <div className="empty">
            <span className="tile-icon"><Icon name="search-list-01" /></span>
            <p><strong>{view.status === "completed" ? "No findings here" : "Nothing flagged yet"}</strong>Each finding shows up here the moment a check fails, with the documents that prove it.</p>
          </div>
        )}
        {shown.map((finding) => (
          <FindingItem key={finding.id} finding={finding} open={open.has(finding.id)} reviewed={reviewed.has(finding.id)}
            onToggle={() => setOpen((s) => toggled(s, finding.id))} onReview={() => setReviewed((s) => toggled(s, finding.id))} />
        ))}
      </div>
      {view.status === "completed" && (view.passed.length > 0 || view.incomplete.length > 0) && (
        <div className="outcomes">
          {view.incomplete.length > 0 && (
            <Outcome warn icon="alert-circle" title={`${plural(view.incomplete.length, "invoice")} not fully checked`} refs={view.incomplete}
              note="A check could not finish (see Activity). Run the audit again before relying on these." />
          )}
          {view.passed.length > 0 && <Outcome icon="checkmark-circle-02" title={`${plural(view.passed.length, "invoice")} passed every check`} refs={view.passed} />}
        </div>
      )}
    </aside>
  );
}
