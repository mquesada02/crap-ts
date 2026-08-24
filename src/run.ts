import { readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  basename,
  dirname,
  isAbsolute,
  relative as pathRelative,
  resolve,
} from "node:path";
import { HELP_MESSAGE, type AnalyzeOptions, type CliResult } from "./cli.js";
import {
  coverageForRange,
  isMissingFile,
  parseLcov,
  type LcovCoverage,
} from "./coverage.js";
import {
  crapScore,
  formatJson,
  formatReport,
  sortByCrap,
  type CrapEntry,
} from "./crap.js";
import { extractFunctions, type ExtractedFunction } from "./functions.js";

export type RunHost = {
  cwd: string;
  stdout: { write(chunk: string): void };
  stderr: { write(chunk: string): void };
  readFile(path: string): string;
  readdir(path: string): { name: string; isDirectory(): boolean; isFile(): boolean }[];
  stat(path: string): { isDirectory(): boolean; isFile(): boolean };
  rm(path: string): void;
  runCommand(command: string): number;
  runCaptured(argv: string[]): { status: number; stdout: string; stderr: string };
};

export function createNodeHost(): RunHost {
  const cwd = process.cwd();
  return {
    cwd,
    stdout: process.stdout,
    stderr: process.stderr,
    readFile: (path) => readFileSync(path, "utf8"),
    readdir: (path) => readdirSync(path, { withFileTypes: true }),
    stat: (path) => statSync(path),
    rm: (path) => rmSync(path, { recursive: true, force: true }),
    runCommand: (command) => {
      const result = spawnSync(command, { shell: true, cwd, stdio: "inherit" });
      return commandExitCode(result.status);
    },
    runCaptured: (argv) => {
      const [cmd, ...args] = argv;
      if (cmd === undefined) {
        return { status: 1, stdout: "", stderr: "" };
      }
      const result = spawnSync(cmd, args, { cwd, encoding: "utf8" });
      return {
        status: commandExitCode(result.error ? 1 : result.status),
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
      };
    },
  };
}

function commandExitCode(status: number | null): number {
  return status ?? 1;
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
  const gitSelect = options.changed || options.changedFunctions;
  const dirty = gitSelect ? discoverChangedFiles(options, host) : undefined;
  if (gitSelect && dirty === undefined) {
    return 1;
  }
  const files = dirty
    ? dirty.map((file) => file.path)
    : discoverFiles(options, host);
  if (files.length === 0) {
    return emptySelection(options, host);
  }
  let keptFunctions: ExtractedFunction[] | undefined;
  if (options.changedFunctions && dirty !== undefined) {
    keptFunctions = joinChangedFunctions(dirty, host);
    if (keptFunctions === undefined) {
      return 1;
    }
    if (keptFunctions.length === 0) {
      return emptySelection(options, host);
    }
  }
  if (!options.useExistingCoverage) {
    host.rm(dirname(resolve(host.cwd, options.lcovPath)));
    const exit = host.runCommand(options.coverageCommand);
    if (exit !== 0) {
      return 1;
    }
  }
  const coverage = loadCoverage(options, host);
  const entries: CrapEntry[] = [];
  if (keptFunctions !== undefined) {
    for (const fn of keptFunctions) {
      entries.push(toEntry(fn, coverage));
    }
  } else {
    for (const file of files) {
      const functions = readFunctions(file, host);
      if (functions === undefined) {
        return 1;
      }
      for (const fn of functions) {
        entries.push(toEntry(fn, coverage));
      }
    }
  }
  const sorted = sortByCrap(entries);
  host.stdout.write(
    options.json ? formatJson(sorted) : formatReport(sorted),
  );
  if (options.threshold !== undefined) {
    let max = 0;
    for (const entry of entries) {
      if (entry.crap !== undefined && entry.crap > max) {
        max = entry.crap;
      }
    }
    if (max > options.threshold) {
      host.stderr.write(
        `CRAP threshold exceeded: ${max} > ${options.threshold}\n`,
      );
      return 2;
    }
  }
  return 0;
}

function writeGitError(
  host: RunHost,
  command: "status" | "diff",
  stderr: string,
): void {
  const detail = stderr.trim();
  host.stderr.write(
    detail === ""
      ? `Error: git ${command} failed\n`
      : `Error: git ${command} failed\n${detail}\n`,
  );
}

function emptySelection(options: AnalyzeOptions, host: RunHost): number {
  host.stdout.write(
    options.json ? formatJson([]) : "No source files to analyze.\n",
  );
  return 0;
}

function toEntry(
  fn: ExtractedFunction,
  coverage: LcovCoverage | undefined,
): CrapEntry {
  const coveragePct =
    coverage === undefined
      ? undefined
      : coverageForRange(coverage, fn.namespace, fn.startLine, fn.endLine);
  return {
    name: fn.name,
    namespace: fn.namespace,
    complexity: fn.complexity,
    coverage: coveragePct,
    crap: crapScore(fn.complexity, coveragePct),
  };
}

function joinChangedFunctions(
  dirty: DirtyFile[],
  host: RunHost,
): ExtractedFunction[] | undefined {
  const kept: ExtractedFunction[] = [];
  for (const file of dirty) {
    if (!file.untracked) {
      const diff = host.runCaptured([
        "git",
        "-C",
        host.cwd,
        "diff",
        "HEAD",
        "-U0",
        "--",
        file.path,
      ]);
      if (diff.status !== 0) {
        writeGitError(host, "diff", diff.stderr);
        return undefined;
      }
      const lines = hunkNewLines(diff.stdout);
      if (lines.size === 0) {
        continue;
      }
      const functions = readFunctions(file.path, host);
      if (functions === undefined) {
        return undefined;
      }
      for (const fn of functions) {
        if (rangeOverlaps(fn.startLine, fn.endLine, lines)) {
          kept.push(fn);
        }
      }
      continue;
    }
    const functions = readFunctions(file.path, host);
    if (functions === undefined) {
      return undefined;
    }
    kept.push(...functions);
  }
  return kept;
}

function readFunctions(
  file: string,
  host: RunHost,
): ExtractedFunction[] | undefined {
  let source: string;
  try {
    source = host.readFile(resolve(host.cwd, file));
  } catch {
    host.stderr.write(`Error: cannot read ${file}\n`);
    return undefined;
  }
  try {
    return extractFunctions(source, file);
  } catch {
    host.stderr.write(`Error: failed to parse ${file}\n`);
    return undefined;
  }
}

function hunkNewLines(diff: string): Set<number> {
  const lines = new Set<number>();
  const header = /^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,(\d+))?\s+@@/gm;
  for (const match of diff.matchAll(header)) {
    const start = Number(match[1]);
    const count = match[2] === undefined ? 1 : Number(match[2]);
    if (count === 0) {
      lines.add(start);
      continue;
    }
    for (let line = start; line < start + count; line++) {
      lines.add(line);
    }
  }
  return lines;
}

function rangeOverlaps(
  start: number,
  end: number,
  lines: Set<number>,
): boolean {
  for (let line = start; line <= end; line++) {
    if (lines.has(line)) {
      return true;
    }
  }
  return false;
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

const SOURCE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
];

type DirtyFile = { path: string; untracked: boolean };

function discoverChangedFiles(
  options: AnalyzeOptions,
  host: RunHost,
): DirtyFile[] | undefined {
  const git = host.runCaptured([
    "git",
    "-C",
    host.cwd,
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
  ]);
  if (git.status !== 0) {
    writeGitError(host, "status", git.stderr);
    return undefined;
  }
  const files: DirtyFile[] = [];
  const seen = new Set<string>();
  for (const record of porcelainRecords(git.stdout)) {
    const posix = posixify(record.path);
    if (
      seen.has(posix) ||
      !isUnderSourceRoots(posix, options.sourceRoots, host.cwd)
    ) {
      continue;
    }
    const absolute = resolve(host.cwd, posix);
    let info;
    try {
      info = host.stat(absolute);
    } catch (error) {
      if (isMissingFile(error)) {
        continue;
      }
      throw error;
    }
    if (
      info.isFile() &&
      !isSkippedPath(posix) &&
      isAnalyzableFile(dirname(absolute), basename(absolute))
    ) {
      seen.add(posix);
      files.push({ path: posix, untracked: record.untracked });
    }
  }
  return files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

function porcelainRecords(
  porcelain: string,
): { path: string; untracked: boolean }[] {
  const parts = porcelain.split("\0");
  const records: { path: string; untracked: boolean }[] = [];
  for (let i = 0; i < parts.length; i++) {
    const record = parts[i];
    if (record === undefined || record.length < 4) {
      continue;
    }
    const xy = record.slice(0, 2);
    const path = record.slice(3);
    if (path === "") {
      continue;
    }
    records.push({ path, untracked: xy === "??" });
    // Porcelain v1 -z rename/copy is `XY dest\0orig\0`. Keep dest, skip orig.
    if (xy.includes("R") || xy.includes("C")) {
      i += 1;
    }
  }
  return records;
}

function isUnderSourceRoots(
  file: string,
  roots: string[],
  cwd: string,
): boolean {
  const resolvedFile = resolve(cwd, file);
  return roots.some((root) => {
    const rel = posixify(pathRelative(resolve(cwd, root), resolvedFile));
    return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
  });
}

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

function isSkippedPath(file: string): boolean {
  return posixify(file).split("/").some((segment) => SKIP_DIRECTORIES.has(segment));
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
