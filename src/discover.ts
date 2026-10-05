import { basename, dirname, relative, resolve } from "node:path";
import { isMissingFile } from "./coverage.js";

export type DiscoveryFs = {
  readdir(path: string): { name: string; isDirectory(): boolean; isFile(): boolean }[];
  stat(path: string): { isDirectory(): boolean; isFile(): boolean };
};

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

// When `testScope` is given, the `__tests__` check looks only at directories
// below it, so a root that itself sits under `__tests__` still works.
export function collectFiles(
  path: string,
  fs: DiscoveryFs,
  files: string[],
  testScope?: string,
): void {
  let info;
  try {
    info = fs.stat(path);
  } catch (error) {
    if (isMissingFile(error)) {
      return;
    }
    throw error;
  }
  if (info.isFile()) {
    if (isAnalyzableFile(scopedDirectory(dirname(path), testScope), basename(path))) {
      files.push(path);
    }
    return;
  }
  if (!info.isDirectory()) {
    return;
  }
  for (const entry of fs.readdir(path)) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRECTORIES.has(entry.name)) {
        collectFiles(resolve(path, entry.name), fs, files, testScope);
      }
      continue;
    }
    if (
      entry.isFile() &&
      isAnalyzableFile(scopedDirectory(path, testScope), entry.name)
    ) {
      files.push(resolve(path, entry.name));
    }
  }
}

function scopedDirectory(directory: string, testScope: string | undefined): string {
  return testScope === undefined ? directory : relative(testScope, directory);
}

export function isSkippedPath(file: string): boolean {
  return posixify(file).split("/").some((segment) => SKIP_DIRECTORIES.has(segment));
}

export function isAnalyzableFile(directory: string, name: string): boolean {
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

export function posixify(path: string): string {
  return path.replaceAll("\\", "/");
}
