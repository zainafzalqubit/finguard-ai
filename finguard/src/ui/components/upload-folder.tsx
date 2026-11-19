"use client";

import { useState } from "react";
import type { CSSProperties, DragEvent, ReactElement } from "react";

import { FILE_KINDS, KIND_ORDER, kindMeta } from "@/domain/file-kinds";
import type { DocumentKind } from "@/domain/types";
import { fileSize, plural } from "@/ui/format";
import { sentFraction } from "@/ui/upload-progress";
import type { UploadPhase } from "@/ui/upload-progress";

import { droppedFiles } from "./dropped-files";
import { Icon } from "./icon";

type FolderState = "idle" | "drag" | "filled" | Exclude<UploadPhase["step"], "idle">;

interface UploadFolderProps {
  /** Files per kind already picked; a kind with files shows its card inside the folder. */
  counts: Record<DocumentKind, number>;
  /** Total bytes of the files that will be sent. */
  bytes: number;
  phase: UploadPhase;
  onFiles: (list: FileList | File[]) => void;
}

const fileCount = (counts: Record<DocumentKind, number>): number => Object.values(counts).reduce((sum, n) => sum + n, 0);

/** Drop zone drawn as a glass folder: cards fan out while dragging and sink in once dropped. */
export function UploadFolder({ counts, bytes, phase, onFiles }: UploadFolderProps): ReactElement {
  // Browsers only reveal how many files are being dragged, not their names, until the drop.
  const [dragCount, setDragCount] = useState<number | null>(null);
  const total = fileCount(counts);
  const ready = FILE_KINDS.every((k) => counts[k.key] > 0);
  const busy = phase.step !== "idle";
  const state: FolderState = busy ? phase.step : dragCount !== null ? "drag" : total > 0 ? "filled" : "idle";
  const fraction = sentFraction(phase);

  const onDragOver = (event: DragEvent<HTMLLabelElement>): void => {
    event.preventDefault();
    if (!busy) setDragCount(event.dataTransfer.items.length);
  };
  const onDragLeave = (event: DragEvent<HTMLLabelElement>): void => {
    // dragleave also fires when moving onto a child; only reset when the pointer really left.
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragCount(null);
  };
  const onDrop = (event: DragEvent<HTMLLabelElement>): void => {
    event.preventDefault();
    setDragCount(null);
    if (busy) return;
    droppedFiles(event.dataTransfer).then(onFiles, () => onFiles(event.dataTransfer.files));
  };

  const copy: Record<FolderState, [string, string]> = {
    idle: ["Drop files here, or browse", "Invoices as PDF. Purchase orders, payments and the vendor list as CSV. Folders work too."],
    drag: [`Drop to add ${plural(dragCount ?? 0, "item")}`, "Folders are opened and every PDF and CSV inside is added."],
    filled: [`${plural(total, "file")} added`, "Drop more, or click to browse."],
    sending: [`Uploading ${plural(total, "file")}`, `${fileSize(Math.round(bytes * fraction))} of ${fileSize(bytes)}`],
    sent: [`${plural(total, "file")} uploaded`, "Starting the audit."],
    failed: ["The upload didn't finish", "Check that the server is running, then retry."],
  };
  const [title, sub] = copy[state];
  const showCheck = state === "sent" || (state === "filled" && ready);

  return (
    <label className="drop" data-state={state} aria-busy={busy} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <input type="file" className="sr-only" multiple disabled={busy} accept=".pdf,.csv" onChange={(e) => { if (e.target.files) onFiles(e.target.files); e.target.value = ""; }} />
      <span className="folder" aria-hidden>
        <span className="folder-back" />
        {KIND_ORDER.map((key, i) => {
          const kind = kindMeta(key);
          const style = { "--i": i - (KIND_ORDER.length - 1) / 2, "--kc": `var(--k-${key})` } as CSSProperties;
          return (
            <span key={key} className="folder-doc" data-in={counts[key] > 0 || undefined} style={style}>
              <Icon name={kind.icon} /><span className="folder-doc-tag">{kind.format}</span>
            </span>
          );
        })}
        <span className="folder-front">
          {state === "sending" && <span className="folder-pct">{Math.round(fraction * 100)}%</span>}
          {state === "failed" && <span className="folder-check bad"><Icon name="alert-circle" /></span>}
          {showCheck && <span className="folder-check"><Icon name="tick-02" /></span>}
        </span>
      </span>
      <strong>{title}</strong>
      <span className="sub">{sub}</span>
    </label>
  );
}
