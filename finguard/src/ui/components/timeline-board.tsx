"use client";

import { useRef } from "react";
import type { CSSProperties, ReactElement } from "react";

import { AGENTS, AGENT_ORDER } from "@/domain/agents";
import { severityColor } from "@/ui/format";
import { findingForTask } from "@/ui/run/derive";
import type { RunView } from "@/ui/run/run-view";

import { AgentAvatar, agentColor } from "./agent-avatar";
import { useTimelineFrame } from "./use-timeline-frame";

interface BoardProps {
  view: RunView;
  follow: boolean;
  onOpenFinding: (findingId: string) => void;
}

const shortLabel = (label: string): string => (label.startsWith("INV-") ? label.slice(4) : label.replace(/\.pdf$/i, "").replace(/^inv-/i, ""));

export function TimelineBoard({ view, follow, onOpenFinding }: BoardProps): ReactElement {
  const rootRef = useRef<HTMLDivElement>(null);
  useTimelineFrame(rootRef, view, follow);

  return (
    <div ref={rootRef}>
      <div className="axis"><div className="strip" data-strip="axis" /></div>
      <div className="board">
        <div className="gridlines"><div className="strip" data-strip="grid" /><div className="now" data-now /></div>
        {AGENT_ORDER.map((agent) => (
          <div key={agent} className="lane">
            <div className="lane-head">
              <AgentAvatar agent={agent} />
              <div><div className="name">{AGENTS[agent].name}</div><div className="sub">{AGENTS[agent].role}</div></div>
            </div>
            <div className="track">
              <div className="strip" data-strip="lane">
                {agent === "rules"
                  ? view.tools.map((tool) => (
                    <div key={tool.id} className={`bar tick ${tool.end === null ? "active" : ""}`} data-start={tool.start} data-end={tool.end ?? ""}
                      style={agentColor("rules")} title={`${AGENTS[tool.agent].name} called ${tool.tool}()${tool.blocked ? " (blocked)" : ""}`} />
                  ))
                  : view.tasks.filter((task) => task.agent === agent).map((task) => {
                    const finding = task.end === null ? undefined : findingForTask(view, task);
                    const style = { ...agentColor(agent), ...(finding ? severityColor(finding.severity) : {}) } as CSSProperties;
                    return (
                      <div key={task.id} className={`bar ${task.end === null ? "active" : ""} ${finding ? "flagged" : ""}`}
                        data-start={task.start} data-end={task.end ?? ""} style={style} title={`${AGENTS[agent].name}: ${task.label}`}
                        onClick={finding ? () => onOpenFinding(finding.id) : undefined}>
                        <span className="full">{task.label}</span><span className="short">{shortLabel(task.label)}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
