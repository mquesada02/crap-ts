# crap-ts

**CRAP** (Change Risk Anti-Pattern) scores for TypeScript Functions.

Combines cyclomatic complexity with test Coverage to identify Functions that are both complex and under-tested — the riskiest code to change.

## Install

```bash
npm install -g crap-ts
```

From this repository:

```bash
pnpm install
pnpm build
pnpm exec crap-ts
```

The binary name is `crap-ts`.

## Usage

From a TypeScript project root:

```bash
crap-ts
```

Unless `--use-existing-coverage` is set, `crap-ts` deletes stale Coverage artifacts for the LCOV output (default `coverage/lcov.info`), runs:

```bash
npx vitest run --coverage --coverage.reporter=lcov --coverage.reportsDirectory=coverage
```

then scores every Function and prints a table sorted worst first.

Skip delete-and-run when Coverage already exists:

```bash
crap-ts --use-existing-coverage
```

Filter to path fragments:

```bash
crap-ts src/auth
```

Fail locally when the worst numeric CRAP is greater than a threshold:

```bash
crap-ts --threshold 30
```

## Output

```
CRAP Report
===========
Function                       Namespace                             CC    Cov%     CRAP
----------------------------------------------------------------------------------------
risky                          src/risky.ts                           5    0.0%     30.0
ok                             src/ok.ts                              1  100.0%      1.0
unknown                        src/missing.ts                         2    N/A       N/A
```

Unknown Coverage is `N/A`, never 0%. N/A rows sort after numeric CRAP.

## Options

```
-h, --help                    Print this help message and exit.
-s, --source-root <path>      Source root to analyze. May be repeated. Default: current directory.
    --lcov <path>             LCOV file to read. Default: coverage/lcov.info.
    --use-existing-coverage   Do not delete Coverage artifacts or run a coverage command.
    --coverage-command <cmd>  Coverage command to run instead of Vitest emitting LCOV.
    --threshold N             Exit 2 when the worst numeric CRAP is greater than N.
```

A non-default `--lcov` requires `--use-existing-coverage` or `--coverage-command`.

`--coverage-command` replaces the default Vitest command entirely.

Path-fragment arguments keep a file if any fragment is a substring of its working-directory-relative path.

Analyzed extensions: `.ts`, `.tsx`, `.mts`, `.cts`. Skipped directories: `node_modules`, `dist`, `build`, `coverage`, `.git`, `target`. Test files (`*.test.*`, `*.spec.*`, `__tests__/`) are skipped.

## CRAP Formula

```
CRAP(fn) = CC² × (1 − coverage)³ + CC
```

- **CC** = cyclomatic complexity (Decision points + 1)
- **coverage** = fraction of hit executable lines in the Function's LCOV range

| Score | Meaning |
|-------|---------|
| 1–5   | Clean — low complexity, well tested |
| 5–30  | Moderate — consider refactoring or adding tests |
| 30+   | Crappy — high complexity with poor Coverage |

## Exit codes

| Code | Meaning |
|------|---------|
| 0    | Success, including empty selection |
| 1    | Usage error, coverage-command failure, unreadable source, or parse error |
| 2    | Quality gate: `--threshold N` and the worst numeric CRAP is greater than N |

The Quality gate is off when `--threshold` is omitted. If every row is N/A, max CRAP is 0 and the gate does not fail.

## Skill

`SKILL.md` is an agent skill: when asked for a CRAP report, an agent can install and run `crap-ts`.
