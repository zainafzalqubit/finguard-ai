"use client";

import { useState } from "react";
import type { CSSProperties, DragEvent, ReactElement } from "react";

import { FILE_KINDS, KIND_ORDER, kindMeta } from "@/domain/file-kinds";
import type { DocumentKind } from "@/domain/types";
import { plural } from "@/ui/format";

import { Icon } from "./icon";

type FolderState = "idle" | "drag" | "filled";

interface UploadFolderProps {
  /** Files per kind already picked; a kind with files shows its card inside the folder. */
  counts: Record<DocumentKind, number>;
  onFiles: (list: FileList) => void;
}

const fileCount = (counts: Record<DocumentKind, number>): number => Object.values(counts).reduce((sum, n) => sum + n, 0);

/** Drop zone drawn as a glass folder: cards fan out while dragging and sink in once dropped. */
export function UploadFolder({ counts, onFiles }: UploadFolderProps): ReactElement {
  // Browsers only reveal how many files are being dragged, not their names, until the drop.
  const [dragCount, setDragCount] = useState<number | null>(null);
  const total = fileCount(counts);
  const ready = FILE_KINDS.every((k) => counts[k.key] > 0);
  const state: FolderState = dragCount !== null ? "drag" : total > 0 ? "filled" : "idle";

  const onDragOver = (event: DragEvent<HTMLLabelElement>): void => {
    event.preventDefault();
    setDragCount(event.dataTransfer.items.length);
  };
  const onDragLeave = (event: DragEvent<HTMLLabelElement>): void => {
    // dragleave also fires when moving onto a child; only reset when the pointer really left.
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragCount(null);
  };
  const onDrop = (event: DragEvent<HTMLLabelElement>): void => {
    event.preventDefault();
    setDragCount(null);
    onFiles(event.dataTransfer.files);
  };

  const title = state === "drag" ? `Drop to add ${plural(dragCount ?? 0, "file")}` : state === "filled" ? `${plural(total, "file")} added` : "Drop files here, or browse";
  const sub = state === "filled" ? "Drop more, or click to browse." : "Invoices as PDF. Purchase orders, payments and the vendor list as CSV.";

  return (
    <label className="drop" data-state={state} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <input type="file" className="sr-only" multiple accept=".pdf,.csv" onChange={(e) => { if (e.target.files) onFiles(e.target.files); e.target.value = ""; }} />
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
          {ready && state === "filled" && <span className="folder-check"><Icon name="tick-02" /></span>}
        </span>
      </span>
      <strong>{title}</strong>
      <span className="sub">{sub}</span>
    </label>
  );
}
