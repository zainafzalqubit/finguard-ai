import { READABLE_FILE } from "@/domain/file-kinds";

/** Files from a drop, including everything inside dropped folders (a folder alone arrives as one empty entry). */
export async function droppedFiles(data: DataTransfer): Promise<File[]> {
  // Entries must be taken synchronously, before the drop event ends.
  const entries = [...data.items].map((item) => item.webkitGetAsEntry()).filter((entry): entry is FileSystemEntry => entry !== null);
  if (entries.length === 0) return [...data.files];
  const nested = await Promise.all(entries.map((entry) => readEntry(entry, false)));
  return nested.flat();
}

async function readEntry(entry: FileSystemEntry, inFolder: boolean): Promise<File[]> {
  // Inside a folder, skip files FinGuard cannot read (desktop.ini, notes) instead of listing them as problems.
  if (isFile(entry)) {
    if (inFolder && !READABLE_FILE.test(entry.name)) return [];
    return [await new Promise<File>((resolve, reject) => entry.file(resolve, reject))];
  }
  if (!isDirectory(entry)) return [];
  const reader = entry.createReader();
  const children: FileSystemEntry[] = [];
  // readEntries returns the folder in batches; an empty batch means the end.
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
    if (batch.length === 0) break;
    children.push(...batch);
  }
  const files = await Promise.all(children.map((child) => readEntry(child, true)));
  return files.flat();
}

const isFile = (entry: FileSystemEntry): entry is FileSystemFileEntry => entry.isFile;
const isDirectory = (entry: FileSystemEntry): entry is FileSystemDirectoryEntry => entry.isDirectory;
