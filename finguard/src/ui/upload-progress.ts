/** Where the upload of a new audit is. `fraction` is the share of bytes sent so far (0..1). */
export type UploadPhase =
  | { step: "idle" }
  | { step: "sending"; fraction: number }
  | { step: "sent" }
  | { step: "failed"; fraction: number };

export const UPLOAD_IDLE: UploadPhase = { step: "idle" };

export function sentFraction(phase: UploadPhase): number {
  if (phase.step === "idle") return 0;
  return phase.step === "sent" ? 1 : phase.fraction;
}

/** Multipart sends files in order, so overall progress maps onto each file by its byte range. */
export function fileProgress(sizes: number[], fraction: number): number[] {
  const total = sizes.reduce((sum, size) => sum + size, 0);
  if (total === 0) return sizes.map(() => fraction);
  const sent = fraction * total;
  let start = 0;
  return sizes.map((size) => {
    const from = start;
    start += size;
    if (size === 0) return sent >= from ? 1 : 0;
    return Math.min(1, Math.max(0, (sent - from) / size));
  });
}
