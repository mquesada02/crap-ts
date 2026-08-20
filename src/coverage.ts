import { readFileSync } from "node:fs";

export type LcovCoverage = Map<string, Map<number, number>>;

export function readLcov(path: string): LcovCoverage | undefined {
  try {
    return parseLcov(readFileSync(path, "utf8"));
  } catch (error) {
    if (isMissingFile(error)) {
      return undefined;
    }
    throw error;
  }
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

export function parseLcov(lcov: string): LcovCoverage {
  const files: LcovCoverage = new Map();
  let currentLines: Map<number, number> | undefined;
  for (const raw of lcov.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("SF:")) {
      currentLines = new Map();
      files.set(line.slice(3), currentLines);
      continue;
    }
    if (currentLines === undefined) {
      continue;
    }
    if (line.startsWith("DA:")) {
      const [lineNumber, hits] = line.slice(3).split(",");
      currentLines.set(Number(lineNumber), Number(hits));
    }
  }
  return files;
}

export function coverageForRange(
  coverage: LcovCoverage,
  filePath: string,
  startLine: number,
  endLine: number,
): number | undefined {
  const lines = linesForFile(coverage, filePath);
  if (lines === undefined) {
    return undefined;
  }
  let executable = 0;
  let hit = 0;
  for (const [line, hits] of lines) {
    if (line < startLine || line > endLine) {
      continue;
    }
    executable++;
    if (hits > 0) {
      hit++;
    }
  }
  if (executable === 0) {
    return undefined;
  }
  return (hit / executable) * 100;
}

function linesForFile(
  coverage: LcovCoverage,
  filePath: string,
): Map<number, number> | undefined {
  const wanted = normalizePath(filePath);
  const exact = coverage.get(wanted) ?? coverage.get(filePath);
  if (exact !== undefined) {
    return exact;
  }
  for (const [candidate, lines] of coverage) {
    if (isPathSuffix(normalizePath(candidate), wanted)) {
      return lines;
    }
  }
  return undefined;
}

function isPathSuffix(path: string, suffix: string): boolean {
  const pathParts = path.split("/").filter((part) => part.length > 0);
  const suffixParts = suffix.split("/").filter((part) => part.length > 0);
  if (suffixParts.length === 0 || suffixParts.length > pathParts.length) {
    return false;
  }
  const offset = pathParts.length - suffixParts.length;
  return suffixParts.every((part, index) => pathParts[offset + index] === part);
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}
