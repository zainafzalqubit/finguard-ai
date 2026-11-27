import type { CSSProperties, ReactElement } from "react";

import { fileProblem, kindMeta } from "@/domain/file-kinds";
import { fileSize } from "@/ui/format";
import { fileProgress, sentFraction } from "@/ui/upload-progress";
import type { UploadPhase } from "@/ui/upload-progress";

import { Icon } from "./icon";
import type { PickedFile } from "./use-upload-files";

interface UploadFileListProps {
  files: PickedFile[];
  phase: UploadPhase;
  onRemove: (index: number) => void;
}

type RowStatus = "picked" | "sending" | "sent" | "failed" | "skipped";

/** Picked files; while uploading, each row fills with its share of the bytes sent. */
export function UploadFileList({ files, phase, onRemove }: UploadFileListProps): ReactElement {
  const sendable = files.filter((f) => f.kind);
  const progress = fileProgress(sendable.map((f) => f.size), sentFraction(phase));
  const progressOf = (file: PickedFile): number => progress[sendable.indexOf(file)] ?? 0;

  const statusOf = (file: PickedFile, done: number): RowStatus => {
    if (phase.step === "idle") return "picked";
    if (!file.kind) return "skipped";
    if (done >= 1) return "sent";
    return phase.step === "failed" ? "failed" : "sending";
  };

  return (
    <ul className="files" data-phase={phase.step}>
      {files.map((f, i) => {
        const done = progressOf(f);
        const status = statusOf(f, done);
        const style = { "--i": i, "--p": done } as CSSProperties;
        return (
          <li key={f.name} className={f.kind ? "" : "unknown"} data-status={status} style={style}>
            <Icon name={/\.pdf$/i.test(f.name) ? "pdf-01" : "csv-01"} />
            <span className="grow">
              <span className="name">{f.name}</span>
              {status === "picked" || status === "skipped"
                ? <span className="sub">{f.kind ? kindMeta(f.kind).label : fileProblem(f.name)}</span>
                : <span className="file-bar" />}
            </span>
            <span className="size">{status === "sending" ? `${fileSize(Math.round(f.size * done))} of ${fileSize(f.size)}` : status === "failed" ? "Upload stopped" : fileSize(f.size)}</span>
            {status === "picked" && <button className="key flat icon" aria-label={`Remove ${f.name}`} onClick={() => onRemove(i)}><Icon name="cancel-01" /></button>}
            {status === "sent" && <span className="file-state ok"><Icon name="tick-02" /></span>}
            {status === "failed" && <span className="file-state bad"><Icon name="alert-circle" /></span>}
          </li>
        );
      })}
    </ul>
  );
}
