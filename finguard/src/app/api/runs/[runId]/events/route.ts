import { connection } from "next/server";
import type { NextRequest } from "next/server";

import { isTerminal, runExists, subscribe } from "@/audit/run-store";
import type { RunEvent } from "@/domain/events";

const HEARTBEAT_MS = 15_000;
const encoder = new TextEncoder();

/** Server-Sent Events: replays the run so far, then streams new events until the run ends. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/runs/[runId]/events">): Promise<Response> {
  await connection();
  const { runId } = await ctx.params;
  if (!runExists(runId)) return Response.json({ error: "Run not found" }, { status: 404 });

  let cleanup = (): void => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let unsubscribe = (): void => {};
      let seq = 0;
      const heartbeat = setInterval(() => !closed && controller.enqueue(encoder.encode(": ping\n\n")), HEARTBEAT_MS);
      cleanup = (): void => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        controller.close();
      };
      const send = (event: RunEvent): void => {
        if (closed) return;
        // The id lets the browser skip events it already has when it reconnects and the run is replayed.
        controller.enqueue(encoder.encode(`id: ${seq++}\ndata: ${JSON.stringify(event)}\n\n`));
        // Close after the end event, but outside subscribe's replay loop.
        if (isTerminal(event)) queueMicrotask(cleanup);
      };
      unsubscribe = subscribe(runId, send);
      request.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
