import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

type Manifest = {
  exports: Record<string, unknown>;
  peerDependencies: Record<string, string>;
  dependencies?: Record<string, string>;
};

const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as Manifest;

test("exports exposes only the entry and the bin", () => {
  expect(Object.keys(manifest.exports).sort()).toEqual([".", "./bin"]);
});

test("typescript is a peer dependency, not a dependency", () => {
  expect(manifest.peerDependencies["typescript"]).toBe(">=5.9 <6.1");
  expect(manifest.dependencies?.["typescript"]).toBeUndefined();
});
