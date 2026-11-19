"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";

import type { RunEvent } from "@/domain/events";

import { postForm } from "./post-form";
import { EMPTY_RUN, runReducer } from "./run-view";
import type { RunView } from "./run-view";

export interface RunControls {
  view: RunView;
  /** Starts an audit. Resolves to an error message the dialog can show, or null on success. */
  startAudit: (form: FormData, onProgress?: (fraction: number) => void) => Promise<string | null>;
}

export function useRun(): RunControls {
  const [view, dispatch] = useReducer(runReducer, EMPTY_RUN);
  const lastSeq = useRef(-1);

  const startAudit = useCallback(async (form: FormData, onProgress?: (fraction: number) => void): Promise<string | null> => {
    try {
      const { ok, body } = await postForm("/api/runs", form, onProgress);
      const reply = body as { runId?: string; error?: string } | null;
      if (!ok || !reply?.runId) return reply?.error ?? "The audit could not start.";
      dispatch({ type: "start", runId: reply.runId });
      return null;
    } catch {
      return "Could not reach the FinGuard server. Is pnpm dev running?";
    }
  }, []);

  // Follow the run's event stream; the server replays past events first, so a reconnect loses nothing.
  useEffect(() => {
    if (!view.runId) return;
    lastSeq.current = -1;
    const source = new EventSource(`/api/runs/${view.runId}/events`);
    source.onmessage = (message: MessageEvent<string>) => {
      const seq = Number(message.lastEventId);
      if (seq <= lastSeq.current) return;
      lastSeq.current = seq;
      const event = JSON.parse(message.data) as RunEvent;
      dispatch({ type: "event", event, receivedAt: Date.now() });
      if (event.type === "run.completed" || event.type === "run.failed") source.close();
    };
    source.onerror = () => {
      if (source.readyState === EventSource.CLOSED) dispatch({ type: "fail", error: "Lost the connection to the audit." });
    };
    return () => source.close();
  }, [view.runId]);

  return { view, startAudit };
}
