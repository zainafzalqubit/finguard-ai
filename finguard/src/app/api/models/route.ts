import { connection } from "next/server";

import { agentRuntime } from "@/agents/module";

/** Model choices for the upload dialog: providers with a key set, plus Offline. Never returns a key. */
export async function GET(): Promise<Response> {
  await connection();
  try {
    const { providers } = await agentRuntime();
    return Response.json({ options: providers.options, defaultProvider: providers.defaultProvider });
  } catch (error) {
    console.error("Could not list models:", error);
    return Response.json({ error: "Could not list models" }, { status: 500 });
  }
}
