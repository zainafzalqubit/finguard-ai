import type { ReactElement } from "react";

import { AGENTS } from "@/domain/agents";
import type { Finding } from "@/domain/types";
import { severityColor } from "@/ui/format";

import { agentColor } from "./agent-avatar";
import { Icon } from "./icon";

const SEVERITY_ICON = { high: "alert-diamond", medium: "alert-circle" } as const;

interface FindingItemProps {
  finding: Finding;
  open: boolean;
  reviewed: boolean;
  onToggle: () => void;
  onReview: () => void;
}

export function FindingItem({ finding, open, reviewed, onToggle, onReview }: FindingItemProps): ReactElement {
  return (
    <article id={`finding-${finding.id}`} className={`finding ${open ? "open" : ""} ${reviewed ? "reviewed" : ""}`} style={severityColor(finding.severity)}>
      <button className="finding-head" aria-expanded={open} onClick={onToggle}>
        <span className="sev-icon"><Icon name={reviewed ? "tick-02" : SEVERITY_ICON[finding.severity]} /></span>
        <span className="finding-main">
          <span className="title">{finding.title}</span>
          <span className="finding-meta">
            <span className="ref">{finding.invoiceNumber}</span>
            <span className="swatch" style={agentColor(finding.raisedBy)} />
            {AGENTS[finding.raisedBy].name}
          </span>
        </span>
        <Icon name="arrow-down-01" className="chev" />
      </button>
      <div className="evidence">
        <div className="evidence-inner">
          <div className="evidence-body">
            <p>{finding.explanation}</p>
            <div className="compare">
              {finding.evidence.map((row) => (
                <div key={`${row.source}-${row.field}`} className="compare-row">
                  <div className="compare-label">{row.field}<span>{row.source}</span></div>
                  <div className="compare-cells">
                    <div className="cell"><small>Expected</small><b>{row.expected}</b></div>
                    <Icon name="arrow-right-01" />
                    <div className="cell found"><small>Found</small><b>{row.found}</b></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="finding-actions">
              <button className="key small" aria-pressed={reviewed} onClick={onReview}><Icon name="tick-02" />{reviewed ? "Reviewed" : "Mark reviewed"}</button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
