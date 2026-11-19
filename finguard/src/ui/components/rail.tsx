import type { ReactElement } from "react";

import { BrandMark, Icon } from "./icon";

/** Sections shown but not yet built for the hackathon. */
const SOON = [
  { icon: "invoice-01", label: "Documents" },
  { icon: "flag-02", label: "Findings" },
];

interface RailProps {
  historyOpen: boolean;
  onHistory: () => void;
}

export function Rail({ historyOpen, onHistory }: RailProps): ReactElement {
  return (
    <nav className="rail" aria-label="Main">
      <div className="rail-top"><div className="mark" title="FinGuard"><BrandMark /></div></div>
      <button className="key flat" aria-current="page" title="Live audit"><Icon name="activity-01" /></button>
      {SOON.map((item) => (
        <button key={item.label} className="key flat" title={`${item.label} (coming soon)`} aria-disabled="true" disabled>
          <Icon name={item.icon} />
        </button>
      ))}
      <button className="key flat" title="Past audits" aria-label="Past audits" aria-haspopup="dialog" aria-expanded={historyOpen} onClick={onHistory}>
        <Icon name="clock-01" />
      </button>
      <div className="spacer" />
      <button className="key flat" title="Rules (coming soon)" aria-disabled="true" disabled><Icon name="sliders-horizontal" /></button>
    </nav>
  );
}
