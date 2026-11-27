import type { CSSProperties, ReactElement } from "react";

import { clock, severityColor } from "@/ui/format";
import type { RunView } from "@/ui/run/run-view";

import { agentColor } from "./agent-avatar";

/** Newest first. A flagged line is a button that opens its finding. */
export function ActivityFeed({ view, onOpenFinding }: { view: RunView; onOpenFinding: (id: string) => void }): ReactElement {
  const severityOf = (findingId: string): CSSProperties => {
    const finding = view.findings.find((f) => f.id === findingId);
    return finding ? severityColor(finding.severity) : {};
  };

  return (
    <section className="feed" aria-label="Activity">
      <div className="feed-head"><h2>Activity</h2><span className="pill">{view.log.length}</span></div>
      <ol className="log" aria-live="polite">
        {view.log.map((line) => {
          const content = (
            <>
              <time>{clock(line.at)}</time>
              <span className="swatch" style={agentColor(line.agent)} />
              <span className="text">{line.text}</span>
            </>
          );
          return (
            <li key={line.id}>
              {line.findingId ? (
                <button className="log-row flag" style={severityOf(line.findingId)} onClick={() => onOpenFinding(line.findingId ?? "")}>{content}</button>
              ) : (
                <div className={`log-row ${line.kind === "tool" ? "tool" : ""}`.trim()}>{content}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
