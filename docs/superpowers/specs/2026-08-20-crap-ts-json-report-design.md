# crap-ts JSON report

Status: ready-for-agent

## Problem Statement

Agents and scripts cannot consume the Uncle Bob table without scraping fixed-width columns. v1 shipped `SKILL.md` against that table. A machine-readable report was parked. Humans still want the table by default.

## Solution

`crap-ts --json` prints a pretty-printed JSON array of Function rows on stdout instead of the table. Default (no `--json`) is unchanged. The Quality gate, Coverage pipeline, file discovery, and Function extraction do not change. Help, README, and `SKILL.md` document the flag. `SKILL.md` prefers `--json` for agents.

## User Stories

1. As an agent, I want `crap-ts --json` to print a JSON array of Function rows on stdout, so that I can parse CRAP without scraping the table.
2. As a TypeScript developer, I want `crap-ts` with no `--json` to still print the Uncle Bob table, so that the human report does not change.
3. As an agent, I want `--json` to replace the table on stdout, so that stdout is one format, not a mixed stream.
4. As a TypeScript developer, I want warnings, usage errors, and Quality-gate messages to stay on stderr when `--json` is set, so that the JSON document is not interleaved with diagnostics.
5. As a TypeScript developer, I want `crap-ts --help` to mention `--json`, so that I can discover the flag without reading the spec.
6. As an agent, I want `--help` to win when both `--help`/`-h` and `--json` are present, so that I can still learn the CLI without analyzing anything.
7. As a TypeScript developer, I want `--json` to be a boolean flag with no short form and no file path, so that it matches `--use-existing-coverage` and does not invent `--output`.
8. As a TypeScript developer, I want a following token after `--json` to be a path-fragment, not a filename, so that `crap-ts --json src/auth` still filters.
9. As a TypeScript developer, I want `--json=true` (and any other `--json=*`) to be an unknown option, so that argv does not silently grow an `=` syntax the rest of the CLI lacks.
10. As an agent, I want the document to be a bare JSON array, so that I iterate rows without unwrapping a version envelope.
11. As an agent, I want each row to have exactly these keys in this order: `function`, `namespace`, `cc`, `coverage`, `crap`, so that the contract is stable and parsers do not see extra fields (line, absolute path, Decision-point list, or anything else).
12. As an agent, I want `function` to be the same report name the table’s Function column would show (`foo`, `Widget.run`, `process.helper`), so that JSON and table name the same Function.
13. As an agent, I want `namespace` to be the cwd-relative path, so that I can open the file.
14. As an agent, I want `cc` to be the integer cyclomatic complexity (starting at 1), so that I do not parse it out of a string.
15. As an agent, I want `coverage` to be a JSON number on a 0–100 scale when Coverage is known, so that it matches the table’s Cov% meaning without the `%` suffix.
16. As an agent, I want `coverage` and `crap` to be JSON `null` when Coverage is unknown, so that missing data is not 0 and is not the string `"N/A"`.
17. As an agent, I want `crap` to be a JSON number when Coverage is known, so that I can sort or gate without parsing the table’s one-decimal display.
18. As an agent, I want `coverage` and `crap` to use the full internal numbers, not `toFixed(1)`, so that rounding stays a table display concern.
19. As an agent, I want rows in the same order as the table (full-precision numeric CRAP descending, then N/A), so that the worst Function is still first and sort does not use the table’s one-decimal display.
20. As an agent, I want pretty-printed JSON (`JSON.stringify(rows, null, 2)`) plus a trailing newline, so that a human who adds `--json` can still read stdout.
21. As an agent, I want an empty file set with `--json` to print `[]` plus a newline and exit 0, so that stdout is always a JSON array on the analysis success path.
22. As an agent, I want that empty `--json` path not to print `No TypeScript files to analyze.` on stdout or stderr, so that the stream stays parseable and quiet.
23. As a TypeScript developer, I want an empty file set without `--json` to still print `No TypeScript files to analyze.` and exit 0, so that v1 story 22 is unchanged.
24. As a TypeScript developer, I want an empty file set not to run Coverage, with or without `--json`, so that a filter that matches nothing is cheap.
25. As a TypeScript developer, I want `--threshold N` to still exit 2 when the worst numeric CRAP is greater than N, including with `--json`, so that the Quality gate is orthogonal to format.
26. As a TypeScript developer, I want the JSON array printed before the Quality-gate stderr line, so that an agent still gets the document when the process fails the gate.
27. As a TypeScript developer, I want omitted `--threshold` never to fail, including with `--json`, so that format does not turn the Quality gate on by itself.
28. As a TypeScript developer, I want an all-N/A result not to trip the Quality gate, including with `--json` (v1 Quality gate unchanged), so that missing Coverage stays a warning, not a gate failure.
29. As a TypeScript developer, I want the Quality-gate message to remain `CRAP threshold exceeded: <max> > N` on stderr, so that format does not change the gate text. `<max>` is the same numeric rendering as v1 (unformatted number interpolation).
30. As a TypeScript developer, I want a coverage-command failure to exit 1 with no JSON document, so that a broken test run is not reported as a score list.
31. As a TypeScript developer, I want unreadable source to exit 1 with `Error: cannot read ${file}` on stderr and no JSON document, so that broken input is not reported as a score list.
32. As a TypeScript developer, I want a parse error to exit 1 with `Error: failed to parse ${file}` on stderr and no JSON document, so that unparseable source is not reported as a score list.
33. As a TypeScript developer, I want a missing LCOV file with `--json` to still warn `Warning: LCOV file not found at ${lcovPath}. Coverage will be N/A.` on stderr and emit rows with `coverage`/`crap` null, so that analysis still completes when Coverage is unknown.
34. As a TypeScript developer, I want `--use-existing-coverage`, `--lcov`, `--coverage-command`, `--source-root`, path-fragments, and `--threshold` to combine with `--json` the same way they combine with the table, so that format is orthogonal to the rest of the CLI.
35. As an agent, I want `SKILL.md` to prefer `crap-ts --json` as the default invocation, so that agents parse the array instead of the table.
36. As a TypeScript developer, I want README and help to list `--json` beside the other flags, so that humans can find it.
37. As a maintainer, I want tests at the `cli`, `crap`, and `run` seams, so that parse, JSON contract, and stdout/stderr/exit behaviour cannot drift independently.

## Implementation Decisions

- No sixth module. `cli` is still a pure argv parser. `crap` still owns report formatting. `run` still orchestrates.
- `cli` adds a boolean `json` field to analyze options, default `false`. `--json` sets it true. No `-j`. No value. `--json=true` (anything starting with `-` that is not a known option) remains `Unknown option: …`.
- Help text gains a `--json` line in the Options block, same column style as existing flags, stating that it prints a JSON array of Function rows on stdout instead of the table.
- `--help` / `-h` is still detected by presence anywhere in argv, before other parsing, so `--json --help` is help on stdout exit 0.
- `crap` exports `formatJson`. Sort remains the caller’s job, using full-precision numeric CRAP (same as today’s table sort, not `toFixed` display). Each row is exactly the five keys in story 11, in that order. Unknown Coverage is JSON `null`, not omitted keys. Pretty-print is two-space indent plus a trailing newline (story 20). Whole numbers may serialize without a decimal (`50` rather than `50.0`).
- `run`: when the file set is empty and `json` is true, write an empty JSON array plus newline to stdout and return 0 (do not write the English empty-selection sentence; do not run Coverage). When the file set is empty and `json` is false, keep the v1 sentence on stdout.
- `run`: after scoring, write `formatJson` when `json` is true, otherwise `formatReport`. Then apply the Quality gate exactly as v1 (print stderr message, exit 2). Analysis failures before the report (coverage-command non-zero, unreadable source, parse error) still return 1 without writing a JSON document.
- README Options and SKILL.md CLI flags list `--json`. SKILL.md usage examples use `crap-ts --json` as the default agent invocation; the table example remains as the human output description, clearly the no-flag report.
- Glossary is unchanged: Function, CRAP, Decision point, Quality gate, Coverage. JSON is a report format, not a new domain term. No ADR.

## Testing Decisions

- Test external behaviour at each touched module’s interface, not private stringify details. Fixtures and return values; no snapshot-of-implementation beyond asserting the JSON document string (pretty-print and key order are the contract).
- `cli`: `--json` sets `json` true; default analyze options include `json` false; `--json src/auth` keeps `src/auth` as a path-fragment; `--json=true` is an unknown option; help message contains `--json`; `--help` still wins when `--json` is also present (existing help-first behaviour). Existing exact-equality argv tests gain `json` false.
- `crap`: `formatJson`, given a mixed known/unknown Coverage list, emits pretty JSON plus trailing newline; exactly the five keys in story 11, in that order; report name and integer complexity appear as `function` and `cc`; unknown Coverage becomes `null` `coverage`/`crap` (keys present); numbers are not pre-rounded. Empty list emits an empty JSON array plus newline. `formatReport` tests stay as they are.
- `run`: `--json` writes the JSON document not the table; empty tree with `--json` writes an empty JSON array plus newline and does not run Coverage; empty tree without `--json` still writes the English sentence; Quality gate still prints on stderr after JSON and exits 2; coverage-command failure / unreadable / parse error still exit 1 with no JSON array on stdout; missing LCOV still warns on stderr and JSON rows have null Coverage. Injected host as today.
- Prior art: existing `cli` argv matrix, `crap` table-formatter fixtures, `run` host injection.

## Out of Scope

- `--changed` / git-based file selection
- CSV, XML, SARIF, NDJSON, `--format`, `--output`, or writing JSON to a file
- Printing table and JSON on the same stream
- Schema version / generated-at / tool envelope around the array
- Analyzing `.js` / `.jsx`
- Auto-detecting Jest vs Vitest vs c8 from package.json
- Configurable Decision-point sets
- Counting default parameters or destructuring defaults
- Full typecheck / tsconfig program construction
- CI-required Quality gate (glossary still avoids “CI gate”; `--threshold` stays off by default)
- Maven-style multi-module grouping
- Mutation testing
- `let` / `var` function bindings
- Object-literal Functions and function-valued properties
- Changing Function extraction, Decision-point set, Coverage join, CRAP formula, table layout, or exit-code meanings other than the empty-`--json` stdout text
- npm publish / version bump (only when the user says **publish**)

## Further Notes

Carves JSON out of v1’s parked list. The v1 spec file is historical; do not rewrite it. Analog clones (crap4clj / crap4go / crap4java) have no JSON report; this is new. TypeScript 5.9.3 parser is unchanged. Package remains `@mquesada02/crap-ts`; binary `crap-ts`.
