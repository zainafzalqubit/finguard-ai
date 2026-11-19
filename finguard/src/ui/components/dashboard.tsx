"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactElement } from "react";

import { useRun } from "@/ui/run/use-run";

import { ActivityFeed } from "./activity-feed";
import { Dock } from "./dock";
import { FindingsPanel } from "./findings-panel";
import { Goal } from "./goal";
import { Rail } from "./rail";
import { Sidebar } from "./sidebar";
import { TimelineBoard } from "./timeline-board";
import { Topbar } from "./topbar";
import { UploadDialog } from "./upload-dialog";

interface DialogState { open: boolean; sample: boolean }

export function Dashboard(): ReactElement {
  const { view, startAudit } = useRun();
  const [dialog, setDialog] = useState<DialogState>({ open: false, sample: false });
  const [follow, setFollow] = useState(true);
  const [focus, setFocus] = useState<{ id: string; nonce: number } | null>(null);

  // `/?audit=sample` starts a sample audit on load: handy for demos and the recorded video.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("audit") !== "sample") return;
    const form = new FormData();
    form.set("sample", "1");
    void startAudit(form);
  }, [startAudit]);

  const openFinding = useCallback((id: string) => setFocus((current) => ({ id, nonce: (current?.nonce ?? 0) + 1 })), []);
  const openUpload = useCallback((sample: boolean) => setDialog({ open: true, sample }), []);
  // Once a run is over there is no live edge to follow, so show the whole run.
  const following = follow && view.status !== "completed" && view.status !== "failed";

  return (
    <div className="app">
      <Rail />
      <Sidebar view={view} onUpload={() => openUpload(false)} onSample={() => openUpload(true)} />
      <main className="stage">
        <Topbar view={view} onNewAudit={() => openUpload(false)} />
        <section className="timeline" aria-label="Agent timeline">
          <Goal view={view} />
          <TimelineBoard view={view} follow={following} onOpenFinding={openFinding} />
          <ActivityFeed view={view} onOpenFinding={openFinding} />
        </section>
        <Dock follow={following} onFollow={setFollow} />
        <FindingsPanel key={view.runId ?? "none"} view={view} focus={focus} />
      </main>
      <UploadDialog open={dialog.open} preferSample={dialog.sample} onClose={() => setDialog({ open: false, sample: false })} onStart={startAudit} />
    </div>
  );
}
