// Loaded with `node --import ./scripts/register.mjs` so scripts can import app code the way Next does:
// "@/x" maps to src/x, and extensionless relative imports try .ts, .tsx, then /index.ts.
import { statSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

const SRC = new URL("../src/", import.meta.url);
const SUFFIXES = ["", ".ts", ".tsx", "/index.ts"];

function isFile(url) {
  try {
    return statSync(fileURLToPath(url)).isFile();
  } catch {
    return false;
  }
}

function firstFile(baseUrl) {
  for (const suffix of SUFFIXES) {
    const url = new URL(baseUrl.href + suffix);
    if (isFile(url)) return url.href;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const isAlias = specifier.startsWith("@/");
    const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
    if (isAlias || (isRelative && context.parentURL?.startsWith("file:"))) {
      const base = isAlias ? new URL(specifier.slice(2), SRC) : new URL(specifier, context.parentURL);
      const found = firstFile(base);
      if (found) return { url: found, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
