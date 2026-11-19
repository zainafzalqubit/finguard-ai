"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactElement } from "react";

import { FILE_KINDS, KIND_ORDER, fileProblem, kindMeta } from "@/domain/file-kinds";
import { fileSize, plural } from "@/ui/format";

import { Icon } from "./icon";
import { useModelOptions } from "./use-model-options";
import { UploadFolder } from "./upload-folder";
import { useUploadFiles } from "./use-upload-files";

interface UploadDialogProps {
  open: boolean;
  preferSample: boolean;
  onClose: () => void;
  onStart: (form: FormData) => Promise<string | null>;
}

export function UploadDialog({ open, preferSample, onClose, onStart }: UploadDialogProps): ReactElement {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const upload = useUploadFiles();
  const modelChoice = useModelOptions(open);
  const [busy, setBusy] = useState(false);
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

  const start = async (): Promise<void> => {
    setBusy(true);
    const form = upload.formData();
    if (modelChoice.selected) form.set("provider", modelChoice.selected);
    const problem = await onStart(form);
    setBusy(false);
    setError(problem);
    if (!problem) onClose();
  };

  const ready = upload.files.filter((f) => f.kind).length;
  const hint = error ?? (upload.missing ? `${upload.missing} of ${FILE_KINDS.length} file types still missing` : `${plural(ready, "file")} ready to check`);

  return (
    <dialog ref={dialogRef} className="sheet" aria-labelledby="upload-title" onClose={onClose} onClick={(e) => e.target === dialogRef.current && onClose()}>
      <header className="sheet-head">
        <div><h2 id="upload-title">New audit</h2><p>Add the files to check. FinGuard reads invoice PDFs and CSV exports.</p></div>
        <button className="key flat icon" aria-label="Close" onClick={onClose}><Icon name="cancel-01" /></button>
      </header>
      <div className="sheet-body" tabIndex={-1}>
        <UploadFolder counts={upload.counts} onFiles={upload.add} />
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
            <ul className="files">
              {upload.files.map((f, i) => (
                <li key={f.name} className={f.kind ? "" : "unknown"} style={{ "--i": i } as CSSProperties}>
                  <Icon name={/\.pdf$/i.test(f.name) ? "pdf-01" : "csv-01"} />
                  <span className="grow"><span className="name">{f.name}</span><span className="sub">{f.kind ? kindMeta(f.kind).label : fileProblem(f.name)}</span></span>
                  <span className="size">{fileSize(f.size)}</span>
                  <button className="key flat icon" aria-label={`Remove ${f.name}`} onClick={() => upload.remove(i)}><Icon name="cancel-01" /></button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <footer className="sheet-foot">
        <span className={`hint ${error ? "error" : ""}`.trim()}>{hint}</span>
        <button className="key" onClick={onClose}>Cancel</button>
        <button className="key primary" disabled={upload.missing > 0 || busy} onClick={() => void start()}>{busy ? "Starting…" : "Start audit"}</button>
      </footer>
    </dialog>
  );
}
