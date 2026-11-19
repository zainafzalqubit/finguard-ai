/** Every threshold the rules use lives here. */
export const RULES_CONFIG = {
  /** Allowed difference between invoice total and PO amount, in cents. */
  poToleranceCents: 0,
  /** Same vendor + same total within this many days counts as a likely duplicate. */
  duplicateWindowDays: 3,
} as const;

export const DAY_MS = 24 * 60 * 60 * 1000;
