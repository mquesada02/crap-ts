import { expect, test } from "vitest";
import { crapScore, formatReport, sortByCrap } from "./crap.js";

test("CRAP equals CC when Coverage is 100%", () => {
  expect(crapScore(5, 100)).toBe(5);
});

test("CRAP equals CC squared plus CC when Coverage is 0%", () => {
  expect(crapScore(5, 0)).toBe(30);
});

test("CRAP uses uncovered cubed at 50% Coverage", () => {
  expect(crapScore(4, 50)).toBe(6);
});

test("unknown Coverage yields unknown CRAP", () => {
  expect(crapScore(3, undefined)).toBeUndefined();
});

test("sorts Functions by numeric CRAP descending then N/A", () => {
  const sorted = sortByCrap([
    { name: "low", namespace: "a.ts", complexity: 1, coverage: 100, crap: 1 },
    { name: "unknown", namespace: "b.ts", complexity: 2, coverage: undefined, crap: undefined },
    { name: "high", namespace: "c.ts", complexity: 5, coverage: 0, crap: 30 },
  ]);
  expect(sorted.map((entry) => entry.name)).toEqual(["high", "low", "unknown"]);
});

test("prints Uncle Bob table with Function, Namespace, CC, Cov%, and CRAP", () => {
  const report = formatReport([
    {
      name: "foo",
      namespace: "src/foo.ts",
      complexity: 3,
      coverage: 85,
      crap: 4.5,
    },
    {
      name: "bar",
      namespace: "src/bar.ts",
      complexity: 2,
      coverage: undefined,
      crap: undefined,
    },
  ]);
  expect(report).toBe(
    [
      "CRAP Report",
      "===========",
      "Function                       Namespace                             CC    Cov%     CRAP",
      "----------------------------------------------------------------------------------------",
      "foo                            src/foo.ts                             3   85.0%      4.5",
      "bar                            src/bar.ts                             2    N/A       N/A",
      "",
    ].join("\n"),
  );
});
