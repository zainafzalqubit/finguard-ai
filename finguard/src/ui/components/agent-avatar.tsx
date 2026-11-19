import type { CSSProperties, ReactElement } from "react";

import { AGENTS } from "@/domain/agents";
import type { AgentId } from "@/domain/types";

import { Icon } from "./icon";

/** Sets the CSS custom property --c, which the avatar, bars and swatches read their colour from. */
export const agentColor = (agent: AgentId): CSSProperties => ({ "--c": AGENTS[agent].colorVar }) as CSSProperties;

export function AgentAvatar({ agent }: { agent: AgentId }): ReactElement {
  return <span className="avatar" style={agentColor(agent)}><Icon name={AGENTS[agent].icon} /></span>;
}
