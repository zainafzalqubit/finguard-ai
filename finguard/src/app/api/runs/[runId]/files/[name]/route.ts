import { connection } from "next/server";

import { loadFile } from "@/audit/run-db";

const CONTENT_TYPES: Record<string, string> = { pdf: "application/pdf", csv: "text/csv; charset=utf-8" };

/** One file an audit read, shown inline so the browser's PDF viewer can preview it. */
export async function GET(_request: Request, ctx: RouteContext<"/api/runs/[runId]/files/[name]">): Promise<Response> {
  await connection();
  const { runId, name } = await ctx.params;
  const type = CONTENT_TYPES[name.split(".").pop()?.toLowerCase() ?? ""];
  if (!type) return Response.json({ error: "Only PDF and CSV files can be previewed" }, { status: 400 });
  try {
    const bytes = loadFile(runId, name);
    if (!bytes) return Response.json({ error: "File not found for this audit" }, { status: 404 });
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": type,
        "Content-Disposition": `inline; filename="${encodeURIComponent(name)}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error(`Could not read ${name} for run ${runId}:`, error);
    return Response.json({ error: "Could not read the file" }, { status: 500 });
  }
}
