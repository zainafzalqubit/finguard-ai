import type { ReactElement } from "react";

import { BrandMark, Icon } from "./icon";

/** Only the live audit view exists for the hackathon; the other sections are shown but not yet built. */
const SOON = [
  { icon: "invoice-01", label: "Documents" },
  { icon: "flag-02", label: "Findings" },
  { icon: "clock-01", label: "Past audits" },
];

export function Rail(): ReactElement {
  return (
    <nav className="rail" aria-label="Main">
      <div className="rail-top"><div className="mark" title="FinGuard"><BrandMark /></div></div>
      <button className="key flat" aria-current="page" title="Live audit"><Icon name="activity-01" /></button>
      {SOON.map((item) => (
        <button key={item.label} className="key flat" title={`${item.label} (coming soon)`} aria-disabled="true" disabled>
          <Icon name={item.icon} />
        </button>
      ))}
      <div className="spacer" />
      <button className="key flat" title="Rules (coming soon)" aria-disabled="true" disabled><Icon name="sliders-horizontal" /></button>
    </nav>
  );
}
