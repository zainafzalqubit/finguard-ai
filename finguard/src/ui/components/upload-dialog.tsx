"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

import { FILE_KINDS, KIND_ORDER, kindMeta } from "@/domain/file-kinds";
import { plural } from "@/ui/format";
import { UPLOAD_IDLE } from "@/ui/upload-progress";
import type { UploadPhase } from "@/ui/upload-progress";

import { Icon } from "./icon";
import { UploadFileList } from "./upload-file-list";
import { UploadFolder } from "./upload-folder";
import { useModelOptions } from "./use-model-options";
import { useUploadFiles } from "./use-upload-files";

interface UploadDialogProps {
  open: boolean;
  preferSample: boolean;
  onClose: () => void;
  onStart: (form: FormData, onProgress: (fraction: number) => void) => Promise<string | null>;
}

/** How long the finished upload stays on screen before the dialog closes, so the checks can land. */
const SENT_HOLD_MS = 700;
const START_LABEL: Record<UploadPhase["step"], string> = { idle: "Start audit", sending: "Uploading…", sent: "Starting…", failed: "Retry upload" };

export function UploadDialog({ open, preferSample, onClose, onStart }: UploadDialogProps): ReactElement {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const upload = useUploadFiles();
  const modelChoice = useModelOptions(open);
  const [phase, setPhase] = useState<UploadPhase>(UPLOAD_IDLE);
  const [error, setError] = useState<string | null>(null);
  const { loadSample } = upload;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // Focus the body, not the close button, so no focus ring shows until the person tabs.
      dialog.querySelector<HTMLElement>(".sheet-body")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (open && preferSample) void loadSample().then(setError);
  }, [open, preferSample, loadSample]);

  // Once bytes are on the way the dialog stays open until the audit starts or the upload fails.
  const locked = phase.step === "sending" || phase.step === "sent";

  const close = (): void => {
    if (locked) return;
    setPhase(UPLOAD_IDLE);
    onClose();
  };

  const start = async (): Promise<void> => {
    setError(null);
    setPhase({ step: "sending", fraction: 0 });
    const form = upload.formData();
    if (modelChoice.selected) form.set("provider", modelChoice.selected);
    let sent = 0;
    const problem = await onStart(form, (fraction) => {
      sent = fraction;
      // Every byte is out: the rest is the server starting the run, so show the upload as done.
      setPhase(fraction >= 1 ? { step: "sent" } : { step: "sending", fraction });
    });
    if (problem) {
      setError(problem);
      setPhase({ step: "failed", fraction: sent });
      return;
    }
    setPhase({ step: "sent" });
    await new Promise((resolve) => setTimeout(resolve, SENT_HOLD_MS));
    setPhase(UPLOAD_IDLE);
    onClose();
  };

  const ready = upload.files.filter((f) => f.kind).length;
  const hint = error ?? (upload.missing ? `${upload.missing} of ${FILE_KINDS.length} file types still missing` : `${plural(ready, "file")} ready to check`);

  return (
    <dialog ref={dialogRef} className="sheet" aria-labelledby="upload-title" onClose={close} onCancel={(e) => { if (locked) e.preventDefault(); }} onClick={(e) => e.target === dialogRef.current && close()}>
      <header className="sheet-head">
        <div><h2 id="upload-title">New audit</h2><p>Add the files to check. FinGuard reads invoice PDFs and CSV exports.</p></div>
        <button className="key flat icon" aria-label="Close" onClick={close}><Icon name="cancel-01" /></button>
      </header>
      <div className="sheet-body" tabIndex={-1}>
        <UploadFolder counts={upload.counts} bytes={upload.bytes} phase={phase} onFiles={upload.add} />
        <section>
          <div className="sheet-label">
            <h3>This audit needs</h3>
            <button className="key flat small" onClick={() => void loadSample().then(setError)}><Icon name="database-01" />Use sample data</button>
          </div>
          <ul className="kinds">
            {KIND_ORDER.map((key) => {
              const kind = kindMeta(key);
              const n = upload.counts[key];
              return (
                <li key={key} className={n ? "ready" : ""}>
                  <span className="doc-icon"><Icon name={kind.icon} /></span>
                  <span className="grow"><span className="name">{kind.label}</span><span className="sub">{kind.hint}</span></span>
                  <span className="kind-state">{n ? <><Icon name="checkmark-circle-02" />{plural(n, "file")}</> : "Missing"}</span>
                </li>
              );
            })}
          </ul>
        </section>
        {modelChoice.options.length > 1 && (
          <section>
            <div className="sheet-label"><h3>Model</h3></div>
            <div className="seg" role="group" aria-label="Model">
              {modelChoice.options.map((option) => (
                <button key={option.provider} aria-pressed={modelChoice.selected === option.provider}
                  title={option.label} onClick={() => modelChoice.select(option.provider)}>
                  {option.label.split(":")[0]}
                </button>
              ))}
            </div>
            <p className="model-name">{modelChoice.options.find((o) => o.provider === modelChoice.selected)?.label}</p>
          </section>
        )}
        {upload.files.length > 0 && (
          <section>
            <div className="sheet-label"><h3>{upload.usingSample ? "Sample files" : "Files"}</h3></div>
            <UploadFileList files={upload.files} phase={phase} onRemove={upload.remove} />
          </section>
        )}
      </div>
      <footer className="sheet-foot">
        <span className={`hint ${error ? "error" : ""}`.trim()}>{hint}</span>
        <button className="key" disabled={locked} onClick={close}>Cancel</button>
        <button className="key primary" disabled={upload.missing > 0 || locked} onClick={() => void start()}>{START_LABEL[phase.step]}</button>
      </footer>
    </dialog>
  );
}
