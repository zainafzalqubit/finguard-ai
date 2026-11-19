import { connection } from "next/server";

import { listSampleFiles } from "@/samples/sample-files";

/** Lists the bundled sample files so the upload dialog can show them before starting. */
export async function GET(): Promise<Response> {
  await connection();
  try {
    return Response.json({ files: await listSampleFiles() });
  } catch (error) {
    console.error("Could not list sample files:", error);
    return Response.json({ error: "Sample files are missing. Run pnpm run samples." }, { status: 500 });
  }
}
