import type { ReactElement } from "react";

import { AGENTS, AGENT_ORDER } from "@/domain/agents";
import { KIND_ORDER, kindMeta } from "@/domain/file-kinds";
import { agentStatus } from "@/ui/run/derive";
import type { RunView } from "@/ui/run/run-view";

import { AgentAvatar } from "./agent-avatar";
import { Icon } from "./icon";

interface SidebarProps {
  view: RunView;
  onUpload: () => void;
  onSample: () => void;
}

export function Sidebar({ view, onUpload, onSample }: SidebarProps): ReactElement {
  return (
    <aside className="side">
      <div className="side-head"><h1>FinGuard</h1></div>

      <section className="section">
        <h2>Documents</h2>
        {KIND_ORDER.map((key) => {
          const kind = kindMeta(key);
          return (
            <div key={key} className="row">
              <span className="doc-icon"><Icon name={kind.icon} /></span>
              <span className="grow"><div className="name">{kind.label}</div><div className="sub">{kind.format}</div></span>
              <span className="count">{view.counts ? view.counts[key] : "-"}</span>
            </div>
          );
        })}
        <div className="upload">
          <button className="key" onClick={onUpload}><Icon name="upload-04" />Upload</button>
          <button className="key icon" onClick={onSample} title="Load sample data" aria-label="Load sample data"><Icon name="database-01" /></button>
        </div>
      </section>

      <section className="section">
        <h2>Agents</h2>
        {AGENT_ORDER.map((agent) => {
          const status = agentStatus(view, agent);
          return (
            <div key={agent} className="row">
              <AgentAvatar agent={agent} />
              <span className="grow"><div className="name">{AGENTS[agent].name}</div><div className="sub">{status.text}</div></span>
              <span className={`led ${status.led}`.trim()} />
            </div>
          );
        })}
      </section>

      <div className="side-foot">{view.model ? `Model: ${view.model}` : "Sample data is synthetic. Every vendor and account is made up."}</div>
    </aside>
  );
}
