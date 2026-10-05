import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, test } from "vitest";
import { analyze } from "./index.js";

const FOO = "export function foo() {\n  return 1;\n}\n";
const BAR = "export function bar(a: number) {\n  if (a) {\n    return 1;\n  }\n  return 2;\n}\n";

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "crap-ts-analyze-"));
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

function listing(root: string): string[] {
  return readdirSync(root, { recursive: true, encoding: "utf8" }).sort();
}

test("returns root-relative POSIX rows with line numbers and coverage", async () => {
  const root = project({
    "src/foo.ts": FOO,
    "coverage/lcov.info": "SF:src/foo.ts\nDA:2,1\nend_of_record\n",
  });
  expect(await analyze({ root, lcovPath: "coverage/lcov.info" })).toEqual([
    {
      file: "src/foo.ts",
      name: "foo",
      namespace: "src/foo.ts",
      startLine: 1,
      endLine: 3,
      complexity: 1,
      coverage: 100,
      crap: 1,
    },
  ]);
});

test("an absolute lcovPath and absolute SF entries are accepted", async () => {
  const root = project({ "src/foo.ts": FOO });
  const lcov = project({});
  const lcovPath = join(lcov, "lcov.info");
  writeFileSync(lcovPath, `SF:${join(root, "src/foo.ts")}\nDA:2,0\nend_of_record\n`);
  const [row] = await analyze({ root, lcovPath });
  expect(row?.coverage).toBe(0);
});

test("a relative lcovPath resolves against root, not the cwd", async () => {
  const root = project({
    "src/foo.ts": FOO,
    "out/lcov.info": "SF:src/foo.ts\nDA:2,1\nend_of_record\n",
  });
  const [row] = await analyze({ root, lcovPath: "out/lcov.info" });
  expect(row?.coverage).toBe(100);
});

test("SF entries match exactly: a path from another package gives no coverage", async () => {
  const root = project({
    "src/foo.ts": FOO,
    "lcov.info": "SF:other/src/foo.ts\nDA:2,1\nend_of_record\n",
  });
  const [row] = await analyze({ root, lcovPath: "lcov.info" });
  expect(row?.coverage).toBeUndefined();
  expect(row?.crap).toBeUndefined();
});

test("a file absent from LCOV gives undefined coverage and crap", async () => {
  const root = project({
    "src/foo.ts": FOO,
    "lcov.info": "SF:src/other.ts\nDA:2,1\nend_of_record\n",
  });
  const [row] = await analyze({ root, lcovPath: "lcov.info" });
  expect(row?.coverage).toBeUndefined();
});

test("a missing LCOV file rejects with an Error naming the path", async () => {
  const root = project({ "src/foo.ts": FOO });
  await expect(analyze({ root, lcovPath: "nope/lcov.info" })).rejects.toThrow(
    "nope/lcov.info",
  );
});

test("a missing LCOV file rejects even when files is empty", async () => {
  const root = project({ "src/foo.ts": FOO });
  await expect(
    analyze({ root, lcovPath: "nope.info", files: [] }),
  ).rejects.toThrow("nope.info");
});

test("a root that does not exist rejects naming the path, with files omitted or given", async () => {
  const parent = project({ "lcov.info": "" });
  const lcovPath = join(parent, "lcov.info");
  const root = join(parent, "gone");
  await expect(analyze({ root, lcovPath })).rejects.toThrow("root does not exist");
  await expect(analyze({ root, lcovPath })).rejects.toThrow(root);
  await expect(analyze({ root, lcovPath, files: [] })).rejects.toThrow(root);
});

test("a root that is a file rejects naming the path", async () => {
  const parent = project({ "file.ts": FOO, "lcov.info": "" });
  const lcovPath = join(parent, "lcov.info");
  const root = join(parent, "file.ts");
  await expect(analyze({ root, lcovPath })).rejects.toThrow("not a directory");
  await expect(analyze({ root, lcovPath })).rejects.toThrow(root);
  await expect(analyze({ root, lcovPath, files: [] })).rejects.toThrow(root);
});

test("omitted files discovers every analysable file under root, skipping tests and build dirs", async () => {
  const root = project({
    "src/foo.ts": FOO,
    "src/foo.test.ts": FOO,
    "src/types.d.ts": "export type A = 1;\n",
    "dist/out.js": FOO,
    "node_modules/x/index.js": FOO,
    "README.md": "# hi\n",
    "lcov.info": "",
  });
  const rows = await analyze({ root, lcovPath: "lcov.info" });
  expect(rows.map((row) => row.file)).toEqual(["src/foo.ts"]);
});

test("a root that itself sits under a build directory still analyses its files", async () => {
  const parent = project({ "build/pkg/src/foo.ts": FOO, "build/pkg/lcov.info": "" });
  const rows = await analyze({
    root: join(parent, "build/pkg"),
    lcovPath: "lcov.info",
  });
  expect(rows.map((row) => row.file)).toEqual(["src/foo.ts"]);
});

test("a root that itself sits under a __tests__ directory still analyses its files", async () => {
  const parent = project({ "__tests__/pkg/src/foo.ts": FOO, "__tests__/pkg/lcov.info": "" });
  const root = join(parent, "__tests__/pkg");
  expect(
    (await analyze({ root, lcovPath: "lcov.info" })).map((row) => row.file),
  ).toEqual(["src/foo.ts"]);
  expect(
    (await analyze({ root, lcovPath: "lcov.info", files: ["src/foo.ts"] })).map(
      (row) => row.file,
    ),
  ).toEqual(["src/foo.ts"]);
});

test("a __tests__ directory below root is still skipped", async () => {
  const root = project({ "src/__tests__/foo.ts": FOO, "lcov.info": "" });
  expect(await analyze({ root, lcovPath: "lcov.info" })).toEqual([]);
});

test("files limits the analysis to the listed files", async () => {
  const root = project({ "src/foo.ts": FOO, "src/bar.ts": BAR, "lcov.info": "" });
  const rows = await analyze({ root, lcovPath: "lcov.info", files: ["src/bar.ts"] });
  expect(rows.map((row) => row.file)).toEqual(["src/bar.ts"]);
});

test("an empty files list gives an empty array", async () => {
  const root = project({ "src/foo.ts": FOO, "lcov.info": "" });
  expect(await analyze({ root, lcovPath: "lcov.info", files: [] })).toEqual([]);
});

test("duplicate listed entries give one set of rows", async () => {
  const root = project({ "src/foo.ts": FOO, "lcov.info": "" });
  const rows = await analyze({
    root,
    lcovPath: "lcov.info",
    files: ["src/foo.ts", "./src/foo.ts", join(root, "src/foo.ts")],
  });
  expect(rows).toHaveLength(1);
});

test("listed files that match a skip rule are dropped silently, even when missing", async () => {
  const root = project({ "src/foo.ts": FOO, "lcov.info": "" });
  const rows = await analyze({
    root,
    lcovPath: "lcov.info",
    files: ["src/missing.test.ts", "src/types.d.ts", "README.md", "dist/x.js", "src/foo.ts"],
  });
  expect(rows.map((row) => row.file)).toEqual(["src/foo.ts"]);
});

test("a listed file that does not exist rejects naming the file", async () => {
  const root = project({ "lcov.info": "" });
  await expect(
    analyze({ root, lcovPath: "lcov.info", files: ["src/gone.ts"] }),
  ).rejects.toThrow("src/gone.ts");
});

test("a listed file outside root rejects naming the file", async () => {
  const root = project({ "lcov.info": "" });
  await expect(
    analyze({ root, lcovPath: "lcov.info", files: ["../escape.ts"] }),
  ).rejects.toThrow("../escape.ts");
});

test("a listed file that fails to parse rejects naming the file", async () => {
  const root = project({ "src/bad.ts": "export function (((\n", "lcov.info": "" });
  await expect(
    analyze({ root, lcovPath: "lcov.info", files: ["src/bad.ts"] }),
  ).rejects.toThrow("src/bad.ts");
});

test("rejects on the first failing listed file in the given order", async () => {
  const root = project({ "lcov.info": "" });
  await expect(
    analyze({ root, lcovPath: "lcov.info", files: ["src/a.ts", "src/b.ts"] }),
  ).rejects.toThrow("src/a.ts");
});

test("rows are ordered by file, then startLine", async () => {
  const root = project({
    "src/b.ts": FOO,
    "src/a.ts": `${FOO}export function second() {\n  return 2;\n}\n`,
    "lcov.info": "",
  });
  const rows = await analyze({ root, lcovPath: "lcov.info" });
  expect(rows.map((row) => `${row.file}:${row.startLine}`)).toEqual([
    "src/a.ts:1",
    "src/a.ts:4",
    "src/b.ts:1",
  ]);
});

test("analyze deletes nothing and writes nothing", async () => {
  const root = project({
    "src/foo.ts": FOO,
    "coverage/lcov.info": "SF:src/foo.ts\nDA:2,1\nend_of_record\n",
  });
  const before = listing(root);
  await analyze({ root, lcovPath: "coverage/lcov.info" });
  expect(listing(root)).toEqual(before);
});
