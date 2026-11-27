import { describe, expect, it } from "vitest";

import { fileProgress, sentFraction } from "@/ui/upload-progress";

describe("upload progress", () => {
  it("fills files in the order they are sent", () => {
    expect(fileProgress([100, 300], 0.125)).toEqual([0.5, 0]);
    expect(fileProgress([100, 300], 0.5)).toEqual([1, 1 / 3]);
    expect(fileProgress([100, 300], 1)).toEqual([1, 1]);
  });

  it("handles empty files and nothing to send", () => {
    expect(fileProgress([0, 100], 0)).toEqual([1, 0]);
    expect(fileProgress([0, 0], 0.4)).toEqual([0.4, 0.4]);
  });

  it("reads the sent share from each phase", () => {
    expect(sentFraction({ step: "idle" })).toBe(0);
    expect(sentFraction({ step: "sending", fraction: 0.3 })).toBe(0.3);
    expect(sentFraction({ step: "sent" })).toBe(1);
    expect(sentFraction({ step: "failed", fraction: 0.6 })).toBe(0.6);
  });
});
