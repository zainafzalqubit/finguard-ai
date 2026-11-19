"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

/** Opens and closes a native <dialog> with `open`, as a modal. Shared by every sheet. */
export function useModal(open: boolean): RefObject<HTMLDialogElement | null> {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // Focus the body, not the close button, so no focus ring shows until the person tabs.
      dialog.querySelector<HTMLElement>(".sheet-body")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return ref;
}
