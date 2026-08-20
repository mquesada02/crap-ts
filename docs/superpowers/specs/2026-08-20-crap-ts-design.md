# crap-ts

Status: ready-for-agent

## Problem Statement

Uncle Bob publishes CRAP analyzers for Clojure, Go, and Java. There is no equivalent for TypeScript. A TypeScript Function that is both complex and under-tested is risky to change, and that risk is not visible without combining cyclomatic complexity with Coverage.

## Solution

`crap-ts` is an installable npm CLI. From a TypeScript project it deletes stale Coverage, runs tests-with-coverage (Vitest by default), reads LCOV, scores every Function with CRAP, and prints a table sorted worst-first. A Quality gate is available for local checking via `--threshold` and is off by default.

## User Stories

1. As a TypeScript developer, I want to run `crap-ts` in a project root, so that I see which Functions are riskiest to change.
2. As a TypeScript developer, I want the report sorted by CRAP descending, so that the worst Function is first.
3. As a TypeScript developer, I want each row to show Function name, file path, CC, Cov%, and CRAP, so that I can see why a score is high.
4. As a TypeScript developer, I want unknown Coverage shown as N/A rather than 0%, so that missing data is not treated as uncovered.
5. As a TypeScript developer, I want N/A rows after numeric rows, so that unknown scores do not look like the worst risk.
6. As a TypeScript developer, I want `crap-ts --help` to print usage and exit 0, so that I can learn the CLI without analyzing anything.
7. As a TypeScript developer, I want invalid flags to print an error plus usage and exit 1, so that mistakes are obvious.
8. As a TypeScript developer, I want a default coverage command of Vitest emitting LCOV, so that a typical TS project works without extra flags.
9. As a TypeScript developer, I want `--coverage-command` to override how Coverage is generated, so that Jest, c8, or npm scripts still work.
10. As a TypeScript developer, I want `--use-existing-coverage` to skip delete-and-run, so that I can score against Coverage I already produced.
11. As a TypeScript developer, I want `--lcov` to point at a non-default LCOV file, so that monorepos and custom reporters still join.
12. As a TypeScript developer, I want a non-default `--lcov` to require `--use-existing-coverage` or `--coverage-command`, so that I cannot silently read a stale custom path while the default runner writes somewhere else.
13. As a TypeScript developer, I want stale Coverage artifacts deleted before a fresh run, so that scores are not from yesterday's tests.
14. As a TypeScript developer, I want a coverage-command failure to fail the CLI with exit 1, so that a broken test run is not reported as clean.
15. As a TypeScript developer, I want a missing LCOV file to warn on stderr and mark Coverage N/A, including with `--use-existing-coverage`, so that analysis still completes.
16. As a TypeScript developer, I want path-fragment arguments to filter files, so that I can score one module at a time.
17. As a TypeScript developer, I want repeatable `--source-root`, so that I can pin roots other than the current directory.
18. As a TypeScript developer, I want `.ts`, `.tsx`, `.mts`, and `.cts` files analyzed, so that React and ESM/CJS TypeScript variants are included.
19. As a TypeScript developer, I want `node_modules`, `dist`, `build`, `coverage`, `.git`, and `target` skipped, so that dependencies and output are not scored.
20. As a TypeScript developer, I want test files skipped (`*.test.*`, `*.spec.*`, `__tests__/`), so that production Functions are the report.
21. As a TypeScript developer, I want `.js`/`.jsx` ignored, so that this remains a TypeScript tool.
22. As a TypeScript developer, I want an empty file set to print `No TypeScript files to analyze.` and exit 0, so that a filter that matches nothing is not an error.
23. As a TypeScript developer, I want function declarations scored, so that named `function foo` appears in the report.
24. As a TypeScript developer, I want class instance and static Functions scored, so that object-oriented TypeScript is visible.
25. As a TypeScript developer, I want `const foo = () =>` and `const foo = function` scored, so that the usual TS binding style is visible.
26. As a TypeScript developer, I do not want constructors, getters, or setters as rows, so that boilerplate is not treated as Functions.
27. As a TypeScript developer, I want nested named Functions as their own rows, so that a complex helper is not hidden inside its parent.
28. As a TypeScript developer, I want a nested Function's Decision points to count only on that Function, so that CRAP is not double-counted.
29. As a TypeScript developer, I want anonymous callbacks not to get rows, so that `map`/`filter` arrows do not flood the table.
30. As a TypeScript developer, I want anonymous-callback Decision points counted on the enclosing Function, so that those branches still affect risk.
31. As a TypeScript developer, I want CC to start at 1 and add 1 per Decision point, so that scores match Uncle Bob's formula.
32. As a TypeScript developer, I want `if`, loops, `switch` cases including `default`, `catch`, ternary, `&&`, `||`, `??`, `?.`, and logical assignment counted, so that condensed `if`s are not invisible.
33. As a TypeScript developer, I do not want default parameters or destructuring defaults counted, so that signatures do not inflate CC.
34. As a TypeScript developer, I want class Function names reported as `Type.name`, so that overloaded names across classes stay distinct.
35. As a TypeScript developer, I want the namespace column to be the file path relative to the working directory, so that I can open the Function.
36. As a TypeScript developer, I want `--threshold N` to exit 2 when the worst numeric CRAP is greater than N, so that I can locally refuse to leave CRAPpy Functions.
37. As a TypeScript developer, I want the Quality gate off when `--threshold` is omitted, so that CI does not have to fail on CRAP.
38. As a TypeScript developer, I want an all-N/A result not to trip the Quality gate, so that missing Coverage is a warning, not a gate failure.
39. As a TypeScript developer, I want unreadable source or a parse error to exit 1, so that broken input is not silently skipped.
40. As an agent, I want a `SKILL.md`, so that I can run a CRAP report when asked.
41. As a maintainer of crap-ts, I want tests at each module seam, so that formula, extraction, Coverage join, CLI, and orchestration cannot drift independently.

## Implementation Decisions

- Five modules, same seams as crap4go: `cli`, `functions`, `coverage`, `crap`, `run`. The binary calls `cli` then `run`.
- `cli` is a pure argv parser. It returns help, an error, or analyze options (coverage command, use-existing-coverage, lcov path, source roots, threshold, path-fragment filters).
- Default coverage command is `npx vitest run --coverage --coverage.reporter=lcov --coverage.reportsDirectory=coverage`. `--coverage-command` replaces that string entirely.
- Default LCOV path is `coverage/lcov.info`. `--lcov` overrides it. A non-default `--lcov` without `--use-existing-coverage` or `--coverage-command` is a usage error.
- Unless `--use-existing-coverage`, `run` deletes stale Coverage artifacts for the LCOV output (the reports directory that would hold that file), then runs the coverage command with inherited stdio. Non-zero coverage command → exit 1. Missing LCOV after that, or missing LCOV with `--use-existing-coverage`, warns on stderr and every Function is N/A.
- `functions` parses each file with the TypeScript compiler API as a single source file: no program, no typecheck, no tsconfig. A Function at module, class, or nested scope is: a function declaration (including exported and named `export default function`), a class instance or static Function, or a `const`-bound arrow or function expression. Not a constructor, getter, setter, anonymous callback, or anonymous `export default function`.
- Nested named Functions are extracted as their own rows. The CC walk does not count a nested Function's Decision points on the parent. Anonymous callback Decision points count on the enclosing Function.
- Report name: `foo` for a module-scope Function; `Widget.run` for a class Function; nested Functions are prefixed by the enclosing Function name (`process.helper`, `Widget.run.helper`). Namespace: path relative to the working directory.
- Decision points (+1 each, CC starts at 1): `if`; `for` / `for...in` / `for...of` / `for await...of` / `while` / `do...while`; each `switch` `case` and `default`; `catch`; ternary; `&&` `||` `??`; each optional chain (`?.`, `?.()`, `?.[]`); `||=` `&&=` `??=`. Not counted: `else`, default parameters, destructuring defaults, `yield`. `else if` counts because it is another `if`.
- `coverage` parses LCOV. Coverage for a Function is hit executable lines in its inclusive line range divided by executable lines in that range, as a 0–100 percentage. Missing LCOV file, missing file entry, or no executable lines in range → unknown (`undefined`), never 0%. Path matching allows suffix match so absolute LCOV paths still join relative source paths.
- `crap` computes `CC² × (1 − coverageFraction)³ + CC` when Coverage is known. Sort: numeric CRAP descending, then N/A. Table columns: Function, Namespace, CC, Cov%, CRAP. Namespace is Uncle Bob's heading for the working-directory-relative path. Header and separator match Uncle Bob's report shape. Cov% is one decimal plus `%`, or `N/A`; CRAP is one decimal or `N/A`.
- Quality gate: if `--threshold N` is present and the maximum numeric CRAP is `> N`, print `CRAP threshold exceeded: <max> > N` on stderr and exit 2. Missing or invalid N (non-numeric, negative) is a usage error. If there are no numeric CRAP values, max is 0 and the gate does not fail.
- Exit codes: 0 success (including empty selection); 1 usage error, coverage-command failure, unreadable source, parse error; 2 Quality gate.
- File discovery walks each source root (default: cwd). Include `.ts` `.tsx` `.mts` `.cts`. Skip directories named `node_modules`, `dist`, `build`, `coverage`, `.git`, `target`. Skip files matching `*.test.*`, `*.spec.*`, or a `__tests__` path segment. Path-fragment filters keep a file if any fragment is a substring of its path. Deduplicate and sort.
- Delivered as an npm package with binary `crap-ts`, compiled with `tsc`. Includes `README.md` and `SKILL.md`. No JSON report, no `--changed`, no `.js` analysis.

## Testing Decisions

- Test external behaviour at each module's interface, not private walk details. Fixtures and return values; no snapshot-of-implementation.
- `crap`: formula at 0%, 50%, 100%, and unknown Coverage; sort order; table text; threshold comparison (`>` not `>=`; all-N/A does not fail).
- `functions`: fixture source strings covering every extraction rule and every Decision point, including nested-vs-anonymous split, `?.` chains, `??`, logical assignment, skipped constructors/getters/setters/defaults.
- `coverage`: fixture LCOV, range percentage, suffix path match, missing file → unknown, no lines in range → unknown.
- `cli`: argv matrix for help, defaults, each flag, filter args, and usage errors (unknown flag, missing values, `--lcov` pairing).
- `run`: inject process execution, filesystem, and stdout/stderr so the happy path does not shell out. Temp tree → empty selection message, coverage-command failure, missing LCOV warning (both after a run and with `--use-existing-coverage`), printed report, exit 0/1/2, `--use-existing-coverage` does not delete or run. Production uses one real process-executor.
- Prior art: crap4go and crap4java tests at the same seams (cli, complexity/functions, coverage, crap formula, application/run). This repo has no existing tests; Vitest is the runner so the tool can score itself.

## Out of Scope

- `--changed` / git-based file selection
- JSON or other machine-readable reports
- Analyzing `.js` / `.jsx`
- Auto-detecting Jest vs Vitest vs c8 from package.json
- Configurable Decision-point sets
- Counting default parameters or destructuring defaults
- Full typecheck / tsconfig program construction
- CI-required Quality gate
- Maven-style multi-module grouping (one working directory, one LCOV file per run)
- Mutation testing
- `let` / `var` function bindings (only `const` bindings are Functions)
- Object-literal Functions and function-valued properties (`const api = { run() {} }`)

## Further Notes

Formula and report shape follow unclebob/crap4clj, unclebob/crap4go, and unclebob/crap4java. Coverage artifact is LCOV (crap4clj's reliable path; crap4go's file+line-range join). Quality gate behaviour follows crap4java's exit-2 threshold but is opt-in. Glossary: `CONTEXT.md`. `SKILL.md` follows crap4go's skill: when to use, setup, usage, formula, score bands (1–5 / 5–30 / 30+), and the CLI flags. Class expressions use the class's own name if present, otherwise the `const` binding they are assigned to (`const X = class { m() {} }` → `X.m`). `async` and generator Functions are extracted like any other named Function.
