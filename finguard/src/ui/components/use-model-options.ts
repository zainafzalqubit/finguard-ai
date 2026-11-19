"use client";

import { useEffect, useState } from "react";

import type { ModelOption, ProviderId } from "@/domain/models";

export interface ModelChoice {
  options: ModelOption[];
  selected: ProviderId | null;
  select: (provider: ProviderId) => void;
}

/** Loads the providers the server has keys for, preselecting the server's default. */
export function useModelOptions(open: boolean): ModelChoice {
  const [options, setOptions] = useState<ModelOption[]>([]);
  const [selected, setSelected] = useState<ProviderId | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/models")
      .then((response) => response.json() as Promise<{ options?: ModelOption[]; defaultProvider?: ProviderId }>)
      .then((body) => {
        if (cancelled || !body.options) return;
        setOptions(body.options);
        setSelected((current) => current ?? body.defaultProvider ?? null);
      })
      .catch((error: unknown) => console.error("Could not load model options:", error));
    return () => {
      cancelled = true;
    };
  }, [open]);

  return { options, selected, select: setSelected };
}
