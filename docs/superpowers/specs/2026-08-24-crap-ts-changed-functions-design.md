# crap-ts `--changed-functions`

Status: ready-for-agent

## Problem Statement

`--changed` scores every Function in a dirty file, including ones the developer did not edit. Hunk join was parked. A local CRAP report at Function grain is still missing.

## Solution

`crap-ts --changed-functions` uses the same working-tree dirty-file set as `--changed`, then keeps only Functions whose inclusive line range overlaps a `git diff HEAD -U0` new-file hunk. Untracked porcelain (`??`) files score every Function in the file. Tracked dirty files with no hunks contribute no Functions. A newly added tracked file still goes through diff (a full-add hunk keeps every Function). Zero Functions after join is the empty selection (`No source files to analyze.` / `--json` `[]`, exit 0, no Coverage, no table header). `--changed` stays whole-file. Both flags together, or either flag with a path-fragment, is a usage error. No short flag. Coverage still runs the full command when there is something to score.

## User Stories

1. As a TypeScript developer, I want `crap-ts --changed-functions` to score only Functions I edited in dirty files, so that the report is not every Function in those files.
2. As a TypeScript developer, I want dirty files to mean the same working-tree `git status` set as `--changed` (staged, unstaged, untracked), so that I do not have to commit first.
3. As a TypeScript developer, I want `--changed-functions` to ignore `main` and pull-request bases, so that local uncommitted work is not missing.
4. As a TypeScript developer, I want a Function kept when any of its inclusive lines overlaps a new-file hunk from `git diff HEAD -U0`, so that three-line diff context does not pull in a neighbor Function.
5. As a TypeScript developer, I want a delete-only hunk (`+start,0`) to touch line `start`, so that deleting lines inside a Function still scores that Function.
6. As a TypeScript developer, I want an untracked analyzable file to score every Function in that file, so that a new module is not invisible.
7. As a TypeScript developer, I want an untracked file inside a new directory included, so that `--untracked-files=all` still applies.
8. As a TypeScript developer, I want a tracked dirty file with no hunks (chmod-only) to contribute no Functions, so that a path git noticed without a text change is not scored.
9. As a TypeScript developer, I want a dirty file whose hunks miss every Function (import-only edit) to contribute no Functions, so that an untouched Function is not a row.
10. As a TypeScript developer, I want zero Functions after join to be an empty selection (`No source files to analyze.` or `--json` `[]`, exit 0, no Coverage, no table header), so that nothing to score is cheap and quiet.
11. As a TypeScript developer, I want `--changed` with no `--changed-functions` to still score every Function in each dirty file, so that the shipped whole-file flag does not change.
12. As a TypeScript developer, I want `--changed` and `--changed-functions` together to be a usage error, so that I cannot mix file grain and Function grain.
13. As a TypeScript developer, I want `--changed-functions` with a path-fragment to be a usage error, so that I cannot mix two selection modes.
14. As a TypeScript developer, I want `--changed-functions` not to require `--changed`, so that one flag is enough.
15. As a TypeScript developer, I want `--source-root` to still apply, so that dirty files outside the configured roots are dropped before hunk join.
16. As a TypeScript developer, I want dirty test files, declaration files, and skip-dir paths dropped, so that `--changed-functions` uses the same analyzable-file rules as a full run.
17. As a TypeScript developer, I want renamed files scored at the new path, so that I see the file that exists now.
18. As a TypeScript developer, I want deleted dirty files skipped, so that the CLI does not parse a path that is gone.
19. As a TypeScript developer, I want git missing, a non-repo cwd, or a failed `git status` to exit 1 with `Error: git status failed`, so that status failure matches `--changed`.
20. As a TypeScript developer, I want a failed `git diff HEAD -U0` to exit 1 with `Error: git diff failed` on stderr (git’s stderr included when present), no report, and no whole-file fallback, so that a diff failure is obvious and is not `--changed`.
21. As a TypeScript developer, I want `--json` and `--threshold` to compose with `--changed-functions`, so that format and the Quality gate are orthogonal to Function selection.
22. As a TypeScript developer, I want `--lcov`, `--coverage-command`, and `--use-existing-coverage` to compose the same way, so that Coverage generation is unchanged when there is something to score.
23. As a TypeScript developer, I want Coverage generation to remain the full delete-and-run unless `--use-existing-coverage`, so that this flag does not invent a partial test run.
24. As a TypeScript developer, I want `--help` to mention `--changed-functions` with the line `Analyze Functions in git-dirty files that overlap a working-tree diff hunk.`, so that I can discover the flag.
25. As an agent, I want `--help` to win when both `--help`/`-h` and `--changed-functions` are present, so that I can still learn the CLI without analyzing.
26. As a TypeScript developer, I want `--changed-functions` to be a boolean with no short form and no value, so that it matches `--changed` and `--json`.
27. As a TypeScript developer, I want `--changed-functions=true` to be an unknown option, so that argv does not grow an `=` syntax.
28. As a TypeScript developer, I want README and SKILL.md to list `--changed-functions`, spell untracked = whole file, chmod-only = drop, and exclusive with `--changed` / path-fragments, so that humans and agents can find the rules.
29. As an agent, I want the default invocation to stay `crap-ts --json`, so that `--changed-functions` is opt-in. SKILL.md may show `crap-ts --json --changed-functions` as an example.
30. As a maintainer, I want tests at the `cli` and `run` seams, so that parse, dirty-file discovery, hunk join, empty selection, and git failures cannot drift from this spec.

## Implementation Decisions

- No sixth module. `cli` stays a pure argv parser. `run` owns git invocation, dirty-file discovery, hunk join, and the empty-selection path. Function extraction, Coverage join, and CRAP are unchanged: extract as today, then keep or drop rows.
- `cli` adds a boolean `changedFunctions` field to analyze options, default `false`. `--changed-functions` sets it true. No short flag. `--changed-functions=true` is an unknown option.
- `--changed` and `--changed-functions` together is a usage error (`--changed cannot be combined with --changed-functions`). `--changed-functions` together with any path-fragment is a usage error (`--changed-functions cannot be combined with path-fragment arguments`). `--source-root`, `--json`, `--threshold`, `--lcov`, `--coverage-command`, and `--use-existing-coverage` still parse as today.
- Help gains a `--changed-functions` line: `Analyze Functions in git-dirty files that overlap a working-tree diff hunk.` `--changed` help is unchanged.
- Dirty-file set is the `--changed` porcelain path: `git`, `-C`, host cwd, `status`, `--porcelain=v1`, `-z`, `--untracked-files=all`. Same dest-path rename/copy, deleted skip, analyzable-file filter, `--source-root`, dedupe, and sort. Status failure is unchanged (`Error: git status failed`).
- Untracked porcelain (`??`) files that survive those filters are whole-file: every extracted Function is kept. Do not pass them to `git diff`.
- For each remaining tracked dirty file, `run` captures `git`, `-C`, host cwd, `diff`, `HEAD`, `-U0`, `--`, then the dest path. Non-zero status, spawn failure, or missing git: write `Error: git diff failed` on stderr (include git’s stderr text when present) and return 1. No report. Do not fall back to scoring the whole file.
- Parse unified-diff hunk headers for the **new-file** side. A positive new count overlaps those inclusive lines. A zero new count overlaps line `start`. A Function is kept if its inclusive `startLine`–`endLine` overlaps any of those lines. Tracked dirty + no hunks: keep no Functions from that file (do not extract if not needed).
- Join happens before Coverage. No dirty files, no joinable hunks and no untracked files, or zero Functions after extract-and-join: write the empty selection (`No source files to analyze.\n` or `--json` `[]\n`), return 0, do not run Coverage, do not print a table header. When at least one Function remains, Coverage is the full delete-and-run unless `--use-existing-coverage`, then score only the kept Functions.
- README Options and SKILL.md CLI flags list `--changed-functions`. README/SKILL spell untracked = whole file, chmod-only = drop, and exclusive with `--changed` / path-fragments. SKILL.md may show `crap-ts --json --changed-functions`; default agent invocation stays `crap-ts --json`.
- Glossary: Function unchanged. No ADR. Do not rewrite the v1, JSON, `--changed`, object-literal, let/var, or JavaScript-files spec files.

## Testing Decisions

- Test external behaviour at `cli` and `run`. Injected host returns porcelain and diffs (or a failed git) — do not shell out to a real git. No snapshot of the hunk parser’s internals beyond which Function rows / empty selection / exit / stderr appear. No `functions` / `crap` / `coverage` tests for this slice.
- `cli`: `--changed-functions` sets `changedFunctions` true; default analyze options include `changedFunctions` false; `--changed-functions src/auth` is a usage error; `--changed --changed-functions` is a usage error; `--changed-functions=true` is unknown; help contains the `--changed-functions` line; `--help` wins. Existing exact-equality argv tests gain `changedFunctions` false. `--changed` without `--changed-functions` still parses as today.
- `run`: fixture porcelain plus captured diffs. A hunk overlapping one Function keeps that Function and drops a sibling Function in the same file; `--changed` on the same tree still keeps both. Untracked file keeps all its Functions with no diff call for that path. Tracked dirty + empty diff keeps none. Delete-only `+start,0` keeps the Function that contains `start`. Import-only hunk that misses every Function is empty selection and does not run Coverage. No dirty files is empty selection and does not run Coverage. Git status non-zero → exit 1, `Error: git status failed`. Git diff non-zero → exit 1, `Error: git diff failed`, no table/JSON. `--json --changed-functions` still prints JSON; `--threshold` still gates after the report. `--source-root` still drops dirty paths outside the root. Prior art: existing `--changed` porcelain fixtures and `cli` help/argv matrix.

## Out of Scope

- Changing `--changed` from whole dirty files to hunk join
- Comparing to `main`, `origin/main`, or a pull-request merge base
- Allowing `--changed-functions` together with `--changed` or with path-fragments (those combinations stay usage errors)
- Changing the coverage command to run a subset of tests
- Walking constructor, getter, or setter bodies
- Loop-header bindings
- Destructuring bindings, binding lookup, merge / last-write-wins, chain-walking assignment
- Auto-detecting Jest vs Vitest vs c8
- Configurable Decision-point sets
- Full typecheck / tsconfig program
- CI-required Quality gate
- Maven-style multi-module grouping
- Mutation testing
- A short flag or `=` syntax
- Changing Function extraction, Coverage join, CRAP formula, table layout, JSON shape, or exit codes except the new usage errors and `Error: git diff failed`
- npm publish / version bump (only when the user says **publish**)

## Further Notes

Carves Function-level hunk join out of the `--changed` parked list. `--changed` remains crap4java-style whole files. Formula, report shape, Coverage join, Function kinds, and TypeScript 5.9.3 parser are unchanged. Package remains `@mquesada02/crap-ts`; binary `crap-ts`.
