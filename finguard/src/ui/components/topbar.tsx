import type { ReactElement } from "react";

import type { RunStatus, RunView } from "@/ui/run/run-view";

import { Icon } from "./icon";

const STATUS: Record<RunStatus, { text: string; led: string }> = {
  idle: { text: "No audit yet", led: "" },
  starting: { text: "Starting", led: "busy" },
  running: { text: "Running", led: "busy" },
  completed: { text: "Complete", led: "on" },
  failed: { text: "Failed", led: "" },
};

export function Topbar({ view, onNewAudit }: { view: RunView; onNewAudit: () => void }): ReactElement {
  const status = STATUS[view.status];
  return (
    <header className="topbar">
      <span className="title">{view.runId ? `Vendor audit ${view.runId}` : "Vendor audit"}</span>
      <span className="status"><span className={`led ${status.led}`.trim()} />{status.text}</span>
      <span className="spacer" />
      <button className="key primary" onClick={onNewAudit}><Icon name="add-01" />New audit</button>
    </header>
  );
}
