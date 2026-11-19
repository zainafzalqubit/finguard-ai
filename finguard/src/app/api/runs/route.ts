import { runAudit } from "@/audit/run-audit";
import { createRun } from "@/audit/run-store";
import { UploadError, loadUpload } from "@/ingest/load-upload";
import type { UploadedFile } from "@/ingest/load-upload";
import { readSampleFiles } from "@/samples/sample-files";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

async function filesFrom(form: FormData): Promise<UploadedFile[]> {
  if (form.get("sample") === "1") return readSampleFiles();
  const files = form.getAll("files").filter((entry): entry is File => entry instanceof File);
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_UPLOAD_BYTES) throw new UploadError("Files are larger than 25 MB in total");
  return Promise.all(files.map(async (file) => ({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) })));
}

/** Starts an audit. The run continues in the background; the page follows it over SSE. */
export async function POST(request: Request): Promise<Response> {
  try {
    const input = await loadUpload(await filesFrom(await request.formData()));
    const runId = createRun();
    runAudit(runId, input).catch((error: unknown) => console.error(`Audit ${runId} crashed:`, error));
    return Response.json({ runId }, { status: 202 });
  } catch (error) {
    if (error instanceof UploadError) return Response.json({ error: error.message }, { status: 400 });
    console.error("Could not start audit:", error);
    return Response.json({ error: "Could not start the audit. Check the server log." }, { status: 500 });
  }
}
