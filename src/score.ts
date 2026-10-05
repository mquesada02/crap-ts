import type { CoverageLookup } from "./coverage.js";
import { crapScore, type CrapEntry } from "./crap.js";
import type { ExtractedFunction } from "./functions.js";

export function scoreFunctions(
  functions: readonly ExtractedFunction[],
  lookup: CoverageLookup,
): CrapEntry[] {
  return functions.map((fn) => {
    const coverage = lookup(fn.namespace, fn.startLine, fn.endLine);
    return {
      name: fn.name,
      namespace: fn.namespace,
      startLine: fn.startLine,
      endLine: fn.endLine,
      complexity: fn.complexity,
      coverage,
      crap: crapScore(fn.complexity, coverage),
    };
  });
}
