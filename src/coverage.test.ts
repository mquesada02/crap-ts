import { expect, test } from "vitest";
import { crapScore, formatReport, sortByCrap } from "./crap.js";
import { coverageForRange, parseLcov, readLcov } from "./coverage.js";
import { extractFunctions } from "./functions.js";

test("Coverage is hit executable lines over executable lines in range", () => {
  const coverage = parseLcov(`SF:src/foo.ts
DA:10,1
DA:11,0
end_of_record
`);
  expect(coverageForRange(coverage, "src/foo.ts", 10, 11)).toBe(50);
});

test("joins an absolute LCOV path onto a relative source path by suffix", () => {
  const coverage = parseLcov(`SF:/tmp/project/src/foo.ts
DA:10,1
end_of_record
`);
  expect(coverageForRange(coverage, "src/foo.ts", 10, 10)).toBe(100);
});

test("missing file entry yields unknown Coverage", () => {
  const coverage = parseLcov(`SF:src/other.ts
DA:1,1
end_of_record
`);
  expect(coverageForRange(coverage, "src/foo.ts", 1, 10)).toBeUndefined();
});

test("no executable lines in range yields unknown Coverage", () => {
  const coverage = parseLcov(`SF:src/foo.ts
DA:10,1
end_of_record
`);
  expect(coverageForRange(coverage, "src/foo.ts", 20, 30)).toBeUndefined();
});

test("missing LCOV file yields unknown Coverage", () => {
  expect(readLcov("/no/such/coverage/lcov.info")).toBeUndefined();
});

test("fixture source plus LCOV produces numeric CRAP in the sorted table", () => {
  const filePath = "src/foo.ts";
  const functions = extractFunctions(
    `function covered() {
  return 1;
}
function uncovered(x: boolean) {
  if (x) {
    return 1;
  }
  return 0;
}`,
    filePath,
  );
  const covered = functions.find((fn) => fn.name === "covered");
  const uncovered = functions.find((fn) => fn.name === "uncovered");
  if (covered === undefined || uncovered === undefined) {
    throw new Error("expected covered and uncovered Functions");
  }
  const coverage = parseLcov(`SF:${filePath}
DA:${covered.startLine + 1},1
DA:${uncovered.startLine + 1},0
DA:${uncovered.endLine - 1},0
end_of_record
`);
  const entries = sortByCrap(
    functions.map((fn) => {
      const coveragePct = coverageForRange(
        coverage,
        fn.namespace,
        fn.startLine,
        fn.endLine,
      );
      return {
        name: fn.name,
        namespace: fn.namespace,
        complexity: fn.complexity,
        coverage: coveragePct,
        crap: crapScore(fn.complexity, coveragePct),
      };
    }),
  );
  expect(entries.map((entry) => entry.name)).toEqual(["uncovered", "covered"]);
  expect(entries[0]?.crap).toBe(6);
  expect(entries[1]?.crap).toBe(1);
  const report = formatReport(entries);
  expect(report).toContain("0.0%");
  expect(report).toContain("100.0%");
});
