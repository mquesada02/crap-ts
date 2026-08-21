export const HELP_MESSAGE = `Usage: crap-ts [path-fragment ...]

Scores TypeScript Functions with CRAP and prints a table sorted worst first.

Options:
  -h, --help                    Print this help message and exit.
  -s, --source-root <path>      Source root to analyze. May be repeated. Default: current directory.
      --lcov <path>             LCOV file to read. Default: coverage/lcov.info.
      --use-existing-coverage   Do not delete Coverage artifacts or run a coverage command.
      --coverage-command <cmd>  Coverage command to run instead of Vitest emitting LCOV.
      --threshold N             Exit 2 when the worst numeric CRAP is greater than N.
      --json                    Print a JSON array of Function rows instead of the table.
      --changed                 Analyze git-dirty TypeScript files in the working tree.

Arguments:
  path-fragment    Optional source path fragment. When present, only matching
                   TypeScript files under the configured source roots are analyzed.
`;

export const DEFAULT_LCOV_PATH = "coverage/lcov.info";
export const DEFAULT_COVERAGE_COMMAND =
  "npx vitest run --coverage --coverage.reporter=lcov --coverage.reportsDirectory=coverage";

export type AnalyzeOptions = {
  action: "analyze";
  coverageCommand: string;
  useExistingCoverage: boolean;
  lcovPath: string;
  sourceRoots: string[];
  threshold: number | undefined;
  json: boolean;
  changed: boolean;
  pathFragments: string[];
};

type CliError = { action: "error"; message: string };

export type CliResult =
  | { action: "help"; message: string }
  | CliError
  | AnalyzeOptions;

function takeValue(
  args: string[],
  index: number,
  option: string,
): string | CliError {
  const value = args[index + 1];
  if (value === undefined || value === "") {
    return { action: "error", message: `${option} requires a value` };
  }
  return value;
}

export function parseArgs(args: string[]): CliResult {
  if (args.includes("--help") || args.includes("-h")) {
    return { action: "help", message: HELP_MESSAGE };
  }
  const options: AnalyzeOptions = {
    action: "analyze",
    coverageCommand: DEFAULT_COVERAGE_COMMAND,
    useExistingCoverage: false,
    lcovPath: DEFAULT_LCOV_PATH,
    sourceRoots: [],
    threshold: undefined,
    json: false,
    changed: false,
    pathFragments: [],
  };
  let coverageCommandGiven = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === undefined) {
      break;
    }
    if (arg === "--use-existing-coverage") {
      options.useExistingCoverage = true;
      continue;
    }
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--changed") {
      options.changed = true;
      continue;
    }
    if (arg === "--source-root" || arg === "-s") {
      const value = takeValue(args, i, arg);
      if (typeof value !== "string") {
        return value;
      }
      options.sourceRoots.push(value);
      i += 1;
      continue;
    }
    if (arg === "--lcov") {
      const value = takeValue(args, i, arg);
      if (typeof value !== "string") {
        return value;
      }
      options.lcovPath = value;
      i += 1;
      continue;
    }
    if (arg === "--coverage-command") {
      const value = takeValue(args, i, arg);
      if (typeof value !== "string") {
        return value;
      }
      options.coverageCommand = value;
      coverageCommandGiven = true;
      i += 1;
      continue;
    }
    if (arg === "--threshold") {
      const value = takeValue(args, i, arg);
      if (typeof value !== "string") {
        return value;
      }
      const threshold = Number(value);
      if (!Number.isFinite(threshold) || threshold < 0) {
        return {
          action: "error",
          message: "--threshold requires a non-negative number",
        };
      }
      options.threshold = threshold;
      i += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      return { action: "error", message: `Unknown option: ${arg}` };
    }
    options.pathFragments.push(arg);
  }
  if (options.changed && options.pathFragments.length > 0) {
    return {
      action: "error",
      message: "--changed cannot be combined with path-fragment arguments",
    };
  }
  if (options.sourceRoots.length === 0) {
    options.sourceRoots = ["."];
  }
  if (
    options.lcovPath !== DEFAULT_LCOV_PATH &&
    !options.useExistingCoverage &&
    !coverageCommandGiven
  ) {
    return {
      action: "error",
      message: "--lcov requires --use-existing-coverage or --coverage-command",
    };
  }
  return options;
}
