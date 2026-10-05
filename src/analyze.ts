import { readdirSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
} from "node:path";
import {
  coverageForLines,
  isMissingFile,
  parseLcov,
  type CoverageLookup,
} from "./coverage.js";
import type { CrapEntry } from "./crap.js";
import {
  collectFiles,
  isAnalyzableFile,
  isSkippedPath,
  posixify,
} from "./discover.js";
import { extractFunctions } from "./functions.js";
import { scoreFunctions } from "./score.js";

export type CrapRow = CrapEntry & { file: string };

export type AnalyzeOptions = {
  root: string;
  lcovPath: string;
  files?: string[];
};

export async function analyze(options: AnalyzeOptions): Promise<CrapRow[]> {
  const root = resolve(options.root);
  const lookup = await exactLookup(root, options.lcovPath);
  const files =
    options.files === undefined
      ? discoverFiles(root)
      : selectListedFiles(root, options.files);
  const rows: CrapRow[] = [];
  for (const file of files) {
    const source = await readSource(root, file);
    for (const entry of scoreFunctions(parseFunctions(source, file), lookup)) {
      rows.push({ file, ...entry });
    }
  }
  return rows.sort(compareRows);
}

async function exactLookup(
  root: string,
  lcovPath: string,
): Promise<CoverageLookup> {
  let text: string;
  try {
    text = await readFile(resolve(root, lcovPath), "utf8");
  } catch (error) {
    throw new Error(`cannot read LCOV file ${lcovPath}: ${describe(error)}`);
  }
  const byAbsolutePath = new Map<string, Map<number, number>>();
  for (const [sourcePath, lines] of parseLcov(text)) {
    byAbsolutePath.set(resolve(root, sourcePath), lines);
  }
  return (namespace, startLine, endLine) =>
    coverageForLines(
      byAbsolutePath.get(resolve(root, namespace)),
      startLine,
      endLine,
    );
}

function discoverFiles(root: string): string[] {
  const found: string[] = [];
  collectFiles(root, { readdir: readdirWithTypes, stat: statSync }, found, root);
  return [...new Set(found.map((file) => posixify(relative(root, file))))];
}

function readdirWithTypes(path: string) {
  return readdirSync(path, { withFileTypes: true });
}

function selectListedFiles(root: string, listed: string[]): string[] {
  const selected = new Set<string>();
  for (const entry of listed) {
    const absolute = resolve(root, entry);
    const file = posixify(relative(root, absolute));
    if (file === ".." || file.startsWith("../") || isAbsolute(file)) {
      throw new Error(`listed file is outside root: ${entry}`);
    }
    if (
      isSkippedPath(file) ||
      !isAnalyzableFile(dirname(file), basename(file))
    ) {
      continue;
    }
    assertRegularFile(absolute, entry);
    selected.add(file);
  }
  return [...selected];
}

function assertRegularFile(absolute: string, entry: string): void {
  let isFile: boolean;
  try {
    isFile = statSync(absolute).isFile();
  } catch (error) {
    if (isMissingFile(error)) {
      throw new Error(`listed file does not exist: ${entry}`);
    }
    throw new Error(`cannot read listed file ${entry}: ${describe(error)}`);
  }
  if (!isFile) {
    throw new Error(`listed path is not a file: ${entry}`);
  }
}

async function readSource(root: string, file: string): Promise<string> {
  try {
    return await readFile(resolve(root, file), "utf8");
  } catch (error) {
    throw new Error(`cannot read ${file}: ${describe(error)}`);
  }
}

function parseFunctions(source: string, file: string) {
  return extractFunctions(source, file);
}

function compareRows(a: CrapRow, b: CrapRow): number {
  return (
    compareStrings(a.file, b.file) ||
    a.startLine - b.startLine ||
    a.endLine - b.endLine ||
    compareStrings(a.name, b.name)
  );
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
