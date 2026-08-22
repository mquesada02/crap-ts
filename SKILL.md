---
name: crap-ts
description: Use when the user asks for a CRAP report, cyclomatic complexity analysis, or code quality metrics on a TypeScript project
---

# crap-ts — CRAP Metric for TypeScript

Computes the **CRAP** (Change Risk Anti-Pattern) score for every TypeScript Function. CRAP combines cyclomatic complexity with test Coverage to identify Functions that are both complex and under-tested.

## Setup

From a TypeScript project root:

```bash
npm install -g @mquesada02/crap-ts
crap-ts --json
```

Or from this repository:

```bash
pnpm install
pnpm build
pnpm exec crap-ts --json
```

The binary name is `crap-ts`.

## Usage

```bash
# Analyze TypeScript files under the current directory
crap-ts --json

# Filter to specific path fragments
crap-ts --json src/auth

# Score existing Coverage without deleting or running tests
crap-ts --json --use-existing-coverage

# Fail when the worst numeric CRAP is greater than 30
crap-ts --json --threshold 30

# Score only git-dirty files in the working tree
crap-ts --json --changed
```

Unless `--use-existing-coverage` is set, `crap-ts` deletes stale Coverage artifacts, runs `npx vitest run --coverage --coverage.reporter=lcov --coverage.reportsDirectory=coverage`, then analyzes the results.

### Output

`--json` prints a JSON array of Function rows on stdout (preferred for agents). Unknown Coverage is `null`.

```json
[
  {
    "function": "risky",
    "namespace": "src/risky.ts",
    "cc": 5,
    "coverage": 0,
    "crap": 30
  }
]
```

Without `--json`, a table sorted by CRAP, worst first:

```
CRAP Report
===========
Function                       Namespace                             CC    Cov%     CRAP
----------------------------------------------------------------------------------------
risky                          src/risky.ts                           5    0.0%     30.0
ok                             src/ok.ts                              1  100.0%      1.0
```

### CLI flags

```
-h, --help                    Print this help message and exit.
-s, --source-root <path>      Source root to analyze. May be repeated. Default: current directory.
    --lcov <path>             LCOV file to read. Default: coverage/lcov.info.
    --use-existing-coverage   Do not delete Coverage artifacts or run a coverage command.
    --coverage-command <cmd>  Coverage command to run instead of Vitest emitting LCOV.
    --threshold N             Exit 2 when the worst numeric CRAP is greater than N.
    --json                    Print a JSON array of Function rows instead of the table.
    --changed                 Analyze git-dirty TypeScript files in the working tree.
```

A non-default `--lcov` requires `--use-existing-coverage` or `--coverage-command`. `--coverage-command` replaces the default Vitest command entirely.

Exit codes: `0` success (including empty selection); `1` usage error, coverage-command failure, git status failure, unreadable source, or parse error; `2` Quality gate. `--changed` cannot be combined with path-fragments.

## Interpreting Scores

| CRAP Score | Meaning |
|-----------|---------|
| 1–5       | Clean — low complexity, well tested |
| 5–30      | Moderate — consider refactoring or adding tests |
| 30+       | Crappy — high complexity with poor Coverage |

## How It Works

1. Unless `--use-existing-coverage`, deletes the reports directory that would hold the LCOV file and runs the coverage command with inherited stdio
2. Finds `.ts` `.tsx` `.mts` `.cts` files, skipping `node_modules`, `dist`, `build`, `coverage`, `.git`, `target`, and tests. With `--changed`, candidates come from `git status` instead of a full walk.
3. Extracts Functions (declarations, class instance/static Functions, `const`/`let`/`var`-bound arrows/functions, object-literal methods, function-valued properties, property assignments, and identifier assignments (including logical assignment to identifiers and properties)) with line ranges
4. Computes cyclomatic complexity from Decision points (`if`, loops, `switch` cases, `catch`, ternary, `&&` `||` `??`, optional chain, logical assignment)
5. Reads LCOV for per-Function line Coverage
6. Applies CRAP formula: `CC² × (1 − coverage)³ + CC`
7. Sorts by CRAP descending (N/A last) and prints `--json` or the table
