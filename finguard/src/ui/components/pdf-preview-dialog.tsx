"use client";

import type { ReactElement } from "react";

import { Icon } from "./icon";
import { useModal } from "./use-modal";

export interface PreviewTarget {
  runId: string;
  fileName: string;
  /** Shown under the file name, e.g. the invoice number. */
  caption: string;
}

interface PdfPreviewDialogProps {
  target: PreviewTarget | null;
  onClose: () => void;
}

export const fileUrl = (runId: string, fileName: string): string => `/api/runs/${runId}/files/${encodeURIComponent(fileName)}`;

/** The invoice an audit read, in the browser's own PDF viewer. */
export function PdfPreviewDialog({ target, onClose }: PdfPreviewDialogProps): ReactElement {
  const dialogRef = useModal(target !== null);
  const url = target ? fileUrl(target.runId, target.fileName) : null;

  return (
    <dialog ref={dialogRef} className="sheet preview" aria-labelledby="preview-title" onClose={onClose} onClick={(e) => e.target === dialogRef.current && onClose()}>
      <header className="sheet-head">
        <div><h2 id="preview-title">{target?.fileName}</h2><p>{target?.caption}</p></div>
        <div className="preview-actions">
          {url && <a className="key flat small" href={url} target="_blank" rel="noreferrer"><Icon name="link-square-02" />Open in new tab</a>}
          <button className="key flat icon" aria-label="Close" onClick={onClose}><Icon name="cancel-01" /></button>
        </div>
      </header>
      <div className="sheet-body preview-body" tabIndex={-1}>
        {/* Keyed by URL so switching invoices reloads the viewer instead of keeping the old page. */}
        {url && <iframe key={url} className="preview-frame" src={`${url}#view=FitH&toolbar=0`} title={`Preview of ${target?.fileName}`} />}
      </div>
    </dialog>
  );
}
