# crap-ts `--changed`

Status: ready-for-agent

## Problem Statement

Scoring every TypeScript file is noisy when the developer only wants CRAP on what they have touched locally. Path-fragments require knowing a substring. v1 parked git-based selection. Analog: crap4java `--changed`.

## Solution

`crap-ts --changed` scores whole dirty files from `git status` in the working tree (modified, added, untracked), not a PR diff and not individual edited Functions. Git failure is exit 1. Deleted dirty files are skipped. Path-fragments cannot be combined with `--changed`. `--source-root`, `--json`, and `--threshold` still compose. Coverage still runs the full coverage command; `--changed` only filters which files are analyzed.

## User Stories

1. As a TypeScript developer, I want `crap-ts --changed` to score only git-dirty source files, so that the report is about what I have touched locally.
2. As a TypeScript developer, I want dirty to mean working-tree `git status` (staged, unstaged, and untracked), so that I do not have to commit first.
3. As a TypeScript developer, I want `--changed` to ignore `main` and pull-request bases, so that local uncommitted work is not missing.
4. As a TypeScript developer, I want each dirty file scored in full, so that every Function in that file still gets a row (not only the edited hunk).
5. As a TypeScript developer, I want untracked files inside a new directory included, so that a new module folder is not invisible (`--untracked-files=all`).
6. As a TypeScript developer, I want renamed files scored at the new path, so that I see the file that exists now.
7. As a TypeScript developer, I want deleted dirty files skipped, so that the CLI does not try to parse a path that is gone.
8. As a TypeScript developer, I want an all-deleted (or otherwise empty) dirty set to be an empty selection, so that I get `No TypeScript files to analyze.` or `--json` `[]`, exit 0, and no Coverage run.
9. As a TypeScript developer, I want git missing, a non-repo cwd, or a failed `git status` to exit 1 with an error on stderr, so that a missing git does not look like a clean tree.
10. As a TypeScript developer, I want that error to mention git (`Error: git status failed`), so that the failure is obvious.
11. As a TypeScript developer, I want `--changed` with a path-fragment to be a usage error, so that I cannot mix two selection modes (crap4java: `--changed` cannot combine with file arguments).
12. As a TypeScript developer, I want `--source-root` to still apply, so that dirty files outside the configured roots are dropped, not scored.
13. As a TypeScript developer, I want dirty test files, `.d.ts`, `.js`, and skip-dir paths dropped, so that `--changed` uses the same analyzable-file rules as a full run.
14. As a TypeScript developer, I want `--json` and `--threshold` to compose with `--changed`, so that format and the Quality gate are orthogonal to file selection.
15. As a TypeScript developer, I want `--help` to mention `--changed`, so that I can discover the flag.
16. As an agent, I want `--help` to win when both `--help`/`-h` and `--changed` are present, so that I can still learn the CLI without analyzing.
17. As a TypeScript developer, I want `--changed` to be a boolean flag with no short form and no value, so that it matches `--json`.
18. As a TypeScript developer, I want `--changed=true` to be an unknown option, so that argv does not grow an `=` syntax.
19. As a TypeScript developer, I want Coverage generation unchanged (full delete-and-run unless `--use-existing-coverage`), so that `--changed` does not invent a partial test run.
20. As a TypeScript developer, I want README and SKILL.md to list `--changed`, so that humans and agents can find it.
21. As a maintainer, I want tests at the `cli` and `run` seams, so that parse and git-backed discovery cannot drift independently.

## Implementation Decisions

- No sixth module. `cli` stays a pure argv parser. `run` owns git invocation and the dirty-file filter. Function extraction, Coverage join, and CRAP are unchanged.
- `cli` adds a boolean `changed` field to analyze options, default `false`. `--changed` sets it true. No `-j`-style short flag. `--changed=true` is an unknown option.
- `--changed` together with any path-fragment is a usage error (`--changed cannot be combined with path-fragment arguments`). `--source-root`, `--json`, `--threshold`, `--lcov`, `--coverage-command`, and `--use-existing-coverage` still parse as today.
- Help text gains a `--changed` line: analyze git-dirty TypeScript files in the working tree instead of every file under the source roots.
- `RunHost` gains a captured-process method: argv array (no shell), returns status plus stdout and stderr as strings. The existing coverage `runCommand` stays shell + inherited stdio. Git must not inherit stdio (porcelain would mix into the user’s terminal).
- Git argv: `git`, `-C`, host cwd, `status`, `--porcelain=v1`, `-z`, `--untracked-files=all`. `-z` avoids quoting. `--untracked-files=all` lists files inside untracked directories.
- Non-zero git status, spawn failure, or missing git: write `Error: git status failed` on stderr (include git’s stderr text when present) and return 1. Do not print a report.
- Parse porcelain v1 `-z` records. Use the path that exists now: for rename/copy, the destination path. Skip a path that does not exist (deleted), is not an analyzable TypeScript file, or does not fall under a configured source root after cwd-relative posixify. Deduplicate and sort, same as today’s discovery.
- When `changed` is true, do not walk the tree for candidates; git is the candidate list, then the analyzable/root filters. When `changed` is false, discovery is unchanged.
- README Options and SKILL.md CLI flags list `--changed`. SKILL.md may show `crap-ts --json --changed` as an agent example; default agent invocation stays `crap-ts --json`.
- Glossary unchanged. No ADR. Do not rewrite the v1 spec or the JSON spec.

## Testing Decisions

- Test external behaviour at `cli` and `run`. Injected host returns porcelain (or a failed git) — do not shell out to a real git in unit tests. No snapshot of the porcelain parser’s internals beyond the report file set / exit / stderr.
- `cli`: `--changed` sets `changed` true; default is false; `--changed src/auth` is a usage error; `--changed=true` is unknown; help contains `--changed`; `--help` wins. Existing exact-equality argv tests gain `changed` false.
- `run`: fixture porcelain with modified / added / untracked / rename / delete; only analyzable dirty files under the source root appear; a `.test.ts` dirty path is dropped; a path outside `--source-root` is dropped; all skipped → empty selection and no Coverage run; git status non-zero → exit 1, stderr contains `Error: git status failed`, no table/JSON; `--json --changed` still prints JSON; `--threshold` still gates after the report. Prior art: existing `run` host injection and `cli` argv matrix.

## Out of Scope

- Scoring only Functions whose lines appear in `git diff` (hunk join)
- Comparing to `main`, `origin/main`, or a pull-request merge base
- Combining `--changed` with path-fragments
- Changing the coverage command to run a subset of tests
- Analyzing `.js` / `.jsx`
- `--changed` writing a file list to disk
- Mutation testing, object-literal Functions, `let`/`var` bindings, and the rest of the v1 parked list except this flag
- npm publish / version bump (only when the user says **publish**)

## Further Notes

Carves `--changed` out of v1’s parked list. Analog is crap4java (porcelain, whole files, no mix with path args) plus `--untracked-files=all` so new directories are visible. Coverage artifact is still whole-project LCOV; a Function in a dirty file can have Coverage from tests that were not edited. TypeScript 5.9.3 parser is unchanged. Package remains `@mquesada02/crap-ts`; binary `crap-ts`.
