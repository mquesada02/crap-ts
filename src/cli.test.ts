import { expect, test } from "vitest";
import { parseArgs } from "./cli.js";

test("--help returns a help action whose message includes usage", () => {
  const result = parseArgs(["--help"]);
  expect(result).toMatchObject({ action: "help" });
  if (result.action !== "help") {
    throw new Error("expected help");
  }
  expect(result.message).toContain("Usage: crap-ts");
});

test("-h returns the same help action as --help", () => {
  expect(parseArgs(["-h"])).toEqual(parseArgs(["--help"]));
});

test("no args analyze with default LCOV, coverage command, cwd root, and no filters", () => {
  expect(parseArgs([])).toEqual({
    action: "analyze",
    coverageCommand:
      "npx vitest run --coverage --coverage.reporter=lcov --coverage.reportsDirectory=coverage",
    useExistingCoverage: false,
    lcovPath: "coverage/lcov.info",
    sourceRoots: ["."],
    threshold: undefined,
    json: false,
    changed: false,
    pathFragments: [],
  });
});

test("parses flags, repeatable source roots, and path-fragment args", () => {
  expect(
    parseArgs([
      "--source-root",
      "src",
      "-s",
      "packages/app",
      "--lcov",
      "tmp/lcov.info",
      "--use-existing-coverage",
      "--coverage-command",
      "npx jest --coverage",
      "--threshold",
      "8",
      "foo",
      "bar",
    ]),
  ).toEqual({
    action: "analyze",
    coverageCommand: "npx jest --coverage",
    useExistingCoverage: true,
    lcovPath: "tmp/lcov.info",
    sourceRoots: ["src", "packages/app"],
    threshold: 8,
    json: false,
    changed: false,
    pathFragments: ["foo", "bar"],
  });
});

test("unknown flag is a usage error", () => {
  const result = parseArgs(["--bogus"]);
  expect(result.action).toBe("error");
  if (result.action !== "error") {
    throw new Error("expected error");
  }
  expect(result.message).toContain("Unknown option: --bogus");
});

test("option without a value is a usage error", () => {
  for (const option of [
    "--source-root",
    "-s",
    "--lcov",
    "--coverage-command",
    "--threshold",
  ]) {
    const result = parseArgs([option]);
    expect(result.action).toBe("error");
    if (result.action !== "error") {
      throw new Error(`expected error for ${option}`);
    }
    expect(result.message).toContain(`${option} requires a value`);
  }
});

test("non-default --lcov without --use-existing-coverage or --coverage-command is a usage error", () => {
  const result = parseArgs(["--lcov", "custom/lcov.info"]);
  expect(result.action).toBe("error");
  if (result.action !== "error") {
    throw new Error("expected error");
  }
  expect(result.message).toContain(
    "--lcov requires --use-existing-coverage or --coverage-command",
  );
});

test("--json sets json true", () => {
  expect(parseArgs(["--json"])).toMatchObject({
    action: "analyze",
    json: true,
  });
});

test("--json src/auth keeps src/auth as a path-fragment", () => {
  expect(parseArgs(["--json", "src/auth"])).toMatchObject({
    action: "analyze",
    json: true,
    pathFragments: ["src/auth"],
  });
});

test("--json=true is an unknown option", () => {
  const result = parseArgs(["--json=true"]);
  expect(result.action).toBe("error");
  if (result.action !== "error") {
    throw new Error("expected error");
  }
  expect(result.message).toContain("Unknown option: --json=true");
});

test("help message mentions --json", () => {
  const result = parseArgs(["--help"]);
  expect(result.action).toBe("help");
  if (result.action !== "help") {
    throw new Error("expected help");
  }
  expect(result.message).toContain("--json");
});

test("--help wins when --json is also present", () => {
  expect(parseArgs(["--json", "--help"])).toMatchObject({ action: "help" });
  expect(parseArgs(["--help", "--json"])).toMatchObject({ action: "help" });
});

test("--changed sets changed true", () => {
  expect(parseArgs(["--changed"])).toMatchObject({
    action: "analyze",
    changed: true,
  });
});

test("--changed with a path-fragment is a usage error", () => {
  const result = parseArgs(["--changed", "src/auth"]);
  expect(result.action).toBe("error");
  if (result.action !== "error") {
    throw new Error("expected error");
  }
  expect(result.message).toContain(
    "--changed cannot be combined with path-fragment arguments",
  );
});

test("--changed=true is an unknown option", () => {
  const result = parseArgs(["--changed=true"]);
  expect(result.action).toBe("error");
  if (result.action !== "error") {
    throw new Error("expected error");
  }
  expect(result.message).toContain("Unknown option: --changed=true");
});

test("help message mentions --changed", () => {
  const result = parseArgs(["--help"]);
  expect(result.action).toBe("help");
  if (result.action !== "help") {
    throw new Error("expected help");
  }
  expect(result.message).toContain("--changed");
});

test("--help wins when --changed is also present", () => {
  expect(parseArgs(["--changed", "--help"])).toMatchObject({ action: "help" });
});

test("non-numeric or negative --threshold is a usage error", () => {
  for (const value of ["nope", "-1"]) {
    const result = parseArgs(["--threshold", value]);
    expect(result.action).toBe("error");
    if (result.action !== "error") {
      throw new Error(`expected error for --threshold ${value}`);
    }
    expect(result.message).toContain("--threshold requires a non-negative number");
  }
});
