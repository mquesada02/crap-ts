import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, relative as pathRelative, resolve } from "node:path";
import { HELP_MESSAGE, type AnalyzeOptions, type CliResult } from "./cli.js";
import {
  coverageForRange,
  isMissingFile,
  parseLcov,
  type LcovCoverage,
} from "./coverage.js";
import { crapScore, formatReport, sortByCrap, type CrapEntry } from "./crap.js";
import { extractFunctions } from "./functions.js";

export type RunHost = {
  cwd: string;
  stdout: { write(chunk: string): void };
  stderr: { write(chunk: string): void };
  readFile(path: string): string;
  readdir(path: string): { name: string; isDirectory(): boolean; isFile(): boolean }[];
  stat(path: string): { isDirectory(): boolean; isFile(): boolean };
};

export function createNodeHost(): RunHost {
  return {
    cwd: process.cwd(),
    stdout: process.stdout,
    stderr: process.stderr,
    readFile: (path) => readFileSync(path, "utf8"),
    readdir: (path) => readdirSync(path, { withFileTypes: true }),
    stat: (path) => statSync(path),
  };
}

export function run(options: CliResult, host: RunHost): number {
  if (options.action === "help") {
    host.stdout.write(options.message);
    return 0;
  }
  if (options.action === "error") {
    host.stderr.write(`${options.message}\n\n${HELP_MESSAGE}`);
    return 1;
  }
  const files = discoverFiles(options, host);
  if (files.length === 0) {
    host.stdout.write("No TypeScript files to analyze.\n");
    return 0;
  }
  const coverage = loadCoverage(options, host);
  const entries: CrapEntry[] = [];
  for (const file of files) {
    let source: string;
    try {
      source = host.readFile(resolve(host.cwd, file));
    } catch {
      host.stderr.write(`Error: cannot read ${file}\n`);
      return 1;
    }
    let functions;
    try {
      functions = extractFunctions(source, file);
    } catch {
      host.stderr.write(`Error: failed to parse ${file}\n`);
      return 1;
    }
    for (const fn of functions) {
      const coveragePct =
        coverage === undefined
          ? undefined
          : coverageForRange(coverage, fn.namespace, fn.startLine, fn.endLine);
      entries.push({
        name: fn.name,
        namespace: fn.namespace,
        complexity: fn.complexity,
        coverage: coveragePct,
        crap: crapScore(fn.complexity, coveragePct),
      });
    }
  }
  host.stdout.write(formatReport(sortByCrap(entries)));
  return 0;
}

function loadCoverage(
  options: AnalyzeOptions,
  host: RunHost,
): LcovCoverage | undefined {
  try {
    return parseLcov(host.readFile(resolve(host.cwd, options.lcovPath)));
  } catch (error) {
    if (isMissingFile(error)) {
      host.stderr.write(
        `Warning: LCOV file not found at ${options.lcovPath}. Coverage will be N/A.\n`,
      );
      return undefined;
    }
    throw error;
  }
}

const SKIP_DIRECTORIES = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".git",
  "target",
]);

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"];

function discoverFiles(options: AnalyzeOptions, host: RunHost): string[] {
  const files: string[] = [];
  for (const root of options.sourceRoots) {
    collectFiles(resolve(host.cwd, root), host, files);
  }
  const unique = [
    ...new Set(
      files.map((file) => posixify(pathRelative(host.cwd, file))),
    ),
  ].sort();
  if (options.pathFragments.length === 0) {
    return unique;
  }
  return unique.filter((file) =>
    options.pathFragments.some((fragment) => file.includes(fragment)),
  );
}

function collectFiles(path: string, host: RunHost, files: string[]): void {
  let info;
  try {
    info = host.stat(path);
  } catch (error) {
    if (isMissingFile(error)) {
      return;
    }
    throw error;
  }
  if (info.isFile()) {
    if (isAnalyzableFile(dirname(path), basename(path))) {
      files.push(path);
    }
    return;
  }
  if (!info.isDirectory()) {
    return;
  }
  for (const entry of host.readdir(path)) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRECTORIES.has(entry.name)) {
        collectFiles(resolve(path, entry.name), host, files);
      }
      continue;
    }
    if (entry.isFile() && isAnalyzableFile(path, entry.name)) {
      files.push(resolve(path, entry.name));
    }
  }
}

function isAnalyzableFile(directory: string, name: string): boolean {
  return isSourceFile(name) && !isTestFile(directory, name);
}

function isSourceFile(name: string): boolean {
  if (
    name.endsWith(".d.ts") ||
    name.endsWith(".d.mts") ||
    name.endsWith(".d.cts")
  ) {
    return false;
  }
  return SOURCE_EXTENSIONS.some((extension) => name.endsWith(extension));
}

function isTestFile(directory: string, name: string): boolean {
  if (name.includes(".test.") || name.includes(".spec.")) {
    return true;
  }
  return posixify(directory).split("/").includes("__tests__");
}

function posixify(path: string): string {
  return path.replaceAll("\\", "/");
}
