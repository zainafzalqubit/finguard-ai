"use client";

import { useCallback, useState } from "react";

import { FILE_KINDS, kindOf } from "@/domain/file-kinds";
import type { DocumentKind } from "@/domain/types";

export interface PickedFile {
  name: string;
  size: number;
  kind: DocumentKind | null;
  /** Null for bundled sample files, which the server reads from disk. */
  file: File | null;
}

export interface UploadFiles {
  files: PickedFile[];
  usingSample: boolean;
  counts: Record<DocumentKind, number>;
  missing: number;
  add: (list: FileList | File[]) => void;
  remove: (index: number) => void;
  loadSample: () => Promise<string | null>;
  formData: () => FormData;
}

export function useUploadFiles(): UploadFiles {
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [usingSample, setUsingSample] = useState(false);

  const add = useCallback((list: FileList | File[]) => {
    setUsingSample(false);
    setFiles((current) => {
      const known = new Set(current.filter((f) => f.file).map((f) => f.name));
      const added = [...list].filter((file) => !known.has(file.name)).map((file) => ({ name: file.name, size: file.size, kind: kindOf(file.name), file }));
      return [...current.filter((f) => f.file), ...added];
    });
  }, []);

  const remove = useCallback((index: number) => {
    setFiles((current) => current.filter((_, i) => i !== index));
  }, []);

  const loadSample = useCallback(async (): Promise<string | null> => {
    try {
      const response = await fetch("/api/samples");
      const body = (await response.json()) as { files?: { name: string; size: number }[]; error?: string };
      if (!response.ok || !body.files) return body.error ?? "Could not load the sample files.";
      setFiles(body.files.map((f) => ({ ...f, kind: kindOf(f.name), file: null })));
      setUsingSample(true);
      return null;
    } catch {
      return "Could not reach the FinGuard server.";
    }
  }, []);

  const formData = useCallback((): FormData => {
    const form = new FormData();
    if (usingSample) form.set("sample", "1");
    else for (const picked of files) if (picked.file && picked.kind) form.append("files", picked.file);
    return form;
  }, [files, usingSample]);

  const counts = Object.fromEntries(FILE_KINDS.map((k) => [k.key, files.filter((f) => f.kind === k.key).length])) as Record<DocumentKind, number>;
  const missing = FILE_KINDS.filter((k) => counts[k.key] === 0).length;
  return { files, usingSample, counts, missing, add, remove, loadSample, formData };
}
