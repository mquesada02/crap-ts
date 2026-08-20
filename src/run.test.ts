import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, test } from "vitest";
import { parseArgs } from "./cli.js";
import { formatReport } from "./crap.js";
import { run, type RunHost } from "./run.js";

function capture() {
  let text = "";
  return {
    write(chunk: string) {
      text += chunk;
    },
    get text() {
      return text;
    },
  };
}

function host(overrides: Partial<RunHost> = {}) {
  const stdout = capture();
  const stderr = capture();
  return {
    stdout,
    stderr,
    host: {
      cwd: "/tmp/project",
      stdout,
      stderr,
      readFile(): string {
        throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      },
      readdir(): { name: string; isDirectory(): boolean; isFile(): boolean }[] {
        return [];
      },
      stat(): { isDirectory(): boolean; isFile(): boolean } {
        throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      },
      ...overrides,
    } satisfies RunHost,
  };
}

test("--help prints usage to stdout and exits 0", () => {
  const io = host();
  expect(run(parseArgs(["--help"]), io.host)).toBe(0);
  expect(io.stdout.text).toContain("Usage: crap-ts");
  expect(io.stderr.text).toBe("");
});

test("invalid flags print an error plus usage to stderr and exit 1", () => {
  const io = host();
  expect(run(parseArgs(["--bogus"]), io.host)).toBe(1);
  expect(io.stderr.text).toContain("Unknown option: --bogus");
  expect(io.stderr.text).toContain("Usage: crap-ts");
  expect(io.stdout.text).toBe("");
});

function fsHost(cwd: string, files: Record<string, string> = {}) {
  for (const [relative, content] of Object.entries(files)) {
    const absolute = join(cwd, relative);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, content);
  }
  return host({
    cwd,
    readFile: (path) => readFileSync(path, "utf8"),
    readdir: (path) => readdirSync(path, { withFileTypes: true }),
    stat: (path) => statSync(path),
  });
}

function project(files: Record<string, string> = {}) {
  return fsHost(mkdtempSync(join(tmpdir(), "crap-ts-")), files);
}

test("empty selection prints a message and exits 0", () => {
  const io = project();
  expect(run(parseArgs(["--use-existing-coverage"]), io.host)).toBe(0);
  expect(io.stdout.text).toBe("No TypeScript files to analyze.\n");
});

test("declaration files are not analyzed", () => {
  const io = project({
    "src/foo.d.ts": "export function foo(): number;",
    "src/bar.d.mts": "export function bar(): number;",
    "src/baz.d.cts": "export function baz(): number;",
  });
  expect(run(parseArgs(["--use-existing-coverage"]), io.host)).toBe(0);
  expect(io.stdout.text).toBe("No TypeScript files to analyze.\n");
});

test("a .js --source-root file is ignored", () => {
  const io = project({
    "src/foo.js": "export function foo() { return 1; }",
  });
  expect(
    run(
      parseArgs(["--use-existing-coverage", "--source-root", "src/foo.js"]),
      io.host,
    ),
  ).toBe(0);
  expect(io.stdout.text).toBe("No TypeScript files to analyze.\n");
});

test("skips .js, test files, and skipped directories", () => {
  const io = project({
    "src/foo.js": "export function foo() { return 1; }",
    "src/foo.test.ts": "function testFoo() { return 1; }",
    "src/foo.spec.ts": "function specFoo() { return 1; }",
    "src/__tests__/bar.ts": "function bar() { return 1; }",
    "node_modules/lib/x.ts": "export function x() { return 1; }",
    "dist/out.ts": "export function out() { return 1; }",
    "build/out.ts": "export function out() { return 1; }",
    "coverage/out.ts": "export function out() { return 1; }",
    ".git/out.ts": "export function out() { return 1; }",
    "target/out.ts": "export function out() { return 1; }",
  });
  expect(run(parseArgs(["--use-existing-coverage"]), io.host)).toBe(0);
  expect(io.stdout.text).toBe("No TypeScript files to analyze.\n");
});

test("path-fragment args that match nothing yield empty selection", () => {
  const io = project({
    "src/foo.ts": "export function foo() { return 1; }",
  });
  expect(run(parseArgs(["--use-existing-coverage", "zzz"]), io.host)).toBe(0);
  expect(io.stdout.text).toBe("No TypeScript files to analyze.\n");
});

test("path-fragment filters match the working-directory-relative path", () => {
  const io = project({
    "src/foo.ts": "export function foo() {\n  return 1;\n}\n",
  });
  expect(run(parseArgs(["--use-existing-coverage", "crap-ts"]), io.host)).toBe(
    0,
  );
  expect(io.stdout.text).toBe("No TypeScript files to analyze.\n");
});

test("prints a CRAP report from existing LCOV and exits 0", () => {
  const io = project({
    "src/foo.ts": "export function foo() {\n  return 1;\n}\n",
    "coverage/lcov.info": "SF:src/foo.ts\nDA:2,1\nend_of_record\n",
  });
  expect(run(parseArgs(["--use-existing-coverage"]), io.host)).toBe(0);
  expect(io.stdout.text).toBe(
    formatReport([
      {
        name: "foo",
        namespace: "src/foo.ts",
        complexity: 1,
        coverage: 100,
        crap: 1,
      },
    ]),
  );
  expect(io.stderr.text).toBe("");
});

test("missing LCOV with --use-existing-coverage warns and scores N/A", () => {
  const io = project({
    "src/foo.ts": "export function foo() {\n  return 1;\n}\n",
  });
  expect(run(parseArgs(["--use-existing-coverage"]), io.host)).toBe(0);
  expect(io.stderr.text).toContain(
    "Warning: LCOV file not found at coverage/lcov.info",
  );
  expect(io.stdout.text).toBe(
    formatReport([
      {
        name: "foo",
        namespace: "src/foo.ts",
        complexity: 1,
        coverage: undefined,
        crap: undefined,
      },
    ]),
  );
});

test("--use-existing-coverage does not delete Coverage artifacts", () => {
  const io = project({
    "src/foo.ts": "export function foo() {\n  return 1;\n}\n",
    "coverage/lcov.info": "SF:src/foo.ts\nDA:2,1\nend_of_record\n",
    "coverage/sentinel.txt": "keep me",
  });
  expect(run(parseArgs(["--use-existing-coverage"]), io.host)).toBe(0);
  expect(readFileSync(join(io.host.cwd, "coverage/sentinel.txt"), "utf8")).toBe(
    "keep me",
  );
});

test("--lcov and --source-root join existing Coverage from those paths", () => {
  const io = project({
    "src/foo.ts": "export function foo() {\n  return 1;\n}\n",
    "other/bar.ts": "export function bar() {\n  return 1;\n}\n",
    "tmp/custom.info": "SF:src/foo.ts\nDA:2,1\nend_of_record\n",
  });
  expect(
    run(
      parseArgs([
        "--use-existing-coverage",
        "--lcov",
        "tmp/custom.info",
        "--source-root",
        "src",
      ]),
      io.host,
    ),
  ).toBe(0);
  expect(io.stdout.text).toContain("foo");
  expect(io.stdout.text).toContain("100.0%");
  expect(io.stdout.text).not.toContain("bar");
});

test("includes .ts .tsx .mts .cts and path-fragment filters", () => {
  const files = {
    "src/a.ts": "export function a() {\n  return 1;\n}\n",
    "src/b.tsx": "export function b() {\n  return 1;\n}\n",
    "src/c.mts": "export function c() {\n  return 1;\n}\n",
    "src/d.cts": "export function d() {\n  return 1;\n}\n",
  };
  const all = project(files);
  expect(run(parseArgs(["--use-existing-coverage"]), all.host)).toBe(0);
  expect(all.stdout.text).toContain("src/a.ts");
  expect(all.stdout.text).toContain("src/b.tsx");
  expect(all.stdout.text).toContain("src/c.mts");
  expect(all.stdout.text).toContain("src/d.cts");

  const filtered = project(files);
  expect(
    run(parseArgs(["--use-existing-coverage", "b.tsx"]), filtered.host),
  ).toBe(0);
  expect(filtered.stdout.text).toContain("src/b.tsx");
  expect(filtered.stdout.text).not.toContain("src/a.ts");
  expect(filtered.stdout.text).not.toContain("src/c.mts");
  expect(filtered.stdout.text).not.toContain("src/d.cts");
});

test("unreadable source exits 1", () => {
  const io = project({
    "src/foo.ts": "export function foo() {\n  return 1;\n}\n",
  });
  const originalRead = io.host.readFile;
  io.host.readFile = (path: string) => {
    if (path.endsWith("foo.ts")) {
      throw Object.assign(new Error("EACCES"), { code: "EACCES" });
    }
    return originalRead(path);
  };
  expect(run(parseArgs(["--use-existing-coverage"]), io.host)).toBe(1);
  expect(io.stderr.text).toContain("src/foo.ts");
});

test("parse error exits 1", () => {
  const io = project({
    "src/foo.ts": "function {",
  });
  expect(run(parseArgs(["--use-existing-coverage"]), io.host)).toBe(1);
  expect(io.stderr.text).toContain("src/foo.ts");
});
