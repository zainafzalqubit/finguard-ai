"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactElement } from "react";

import { latestRunId, runFromUrl } from "@/ui/run/saved-runs";
import { useRun } from "@/ui/run/use-run";

import { ActivityFeed } from "./activity-feed";
import { Dock } from "./dock";
import { FindingsPanel } from "./findings-panel";
import { HistoryDialog } from "./history-dialog";
import { Goal } from "./goal";
import { PdfPreviewDialog } from "./pdf-preview-dialog";
import type { PreviewTarget } from "./pdf-preview-dialog";
import { Rail } from "./rail";
import { Sidebar } from "./sidebar";
import { TimelineBoard } from "./timeline-board";
import { Topbar } from "./topbar";
import { UploadDialog } from "./upload-dialog";

interface DialogState { open: boolean; sample: boolean }

export function Dashboard(): ReactElement {
  const { view, startAudit, openRun } = useRun();
  const [dialog, setDialog] = useState<DialogState>({ open: false, sample: false });
  const [follow, setFollow] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const [focus, setFocus] = useState<{ id: string; nonce: number } | null>(null);

  // On load: `/?audit=sample` starts a sample audit (handy for demos); otherwise reopen the run in the URL, or the newest saved one.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("audit") === "sample") {
      const form = new FormData();
      form.set("sample", "1");
      void startAudit(form);
      return;
    }
    const fromUrl = runFromUrl();
    if (fromUrl) openRun(fromUrl);
    else void latestRunId().then((id) => id && openRun(id));
  }, [startAudit, openRun]);

  const openFinding = useCallback((id: string) => setFocus((current) => ({ id, nonce: (current?.nonce ?? 0) + 1 })), []);
  const openUpload = useCallback((sample: boolean) => setDialog({ open: true, sample }), []);
  // Once a run is over there is no live edge to follow, so show the whole run.
  const following = follow && view.status !== "completed" && view.status !== "failed";

  return (
    <div className="app">
      <Rail historyOpen={historyOpen} onHistory={() => setHistoryOpen(true)} />
      <Sidebar view={view} onUpload={() => openUpload(false)} onSample={() => openUpload(true)} />
      <main className="stage">
        <Topbar view={view} onNewAudit={() => openUpload(false)} />
        <section className="timeline" aria-label="Agent timeline">
          <Goal view={view} />
          <TimelineBoard view={view} follow={following} onOpenFinding={openFinding} />
          <ActivityFeed view={view} onOpenFinding={openFinding} />
        </section>
        <Dock follow={following} onFollow={setFollow} />
        <FindingsPanel key={view.runId ?? "none"} view={view} focus={focus}
          onPreview={(f) => view.runId && setPreview({ runId: view.runId, fileName: f.documentId, caption: `${f.invoiceNumber}: ${f.title}` })} />
      </main>
      <UploadDialog open={dialog.open} preferSample={dialog.sample} onClose={() => setDialog({ open: false, sample: false })} onStart={startAudit} />
      <HistoryDialog open={historyOpen} currentRunId={view.runId} onClose={() => setHistoryOpen(false)} onOpenRun={openRun} />
      <PdfPreviewDialog target={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
