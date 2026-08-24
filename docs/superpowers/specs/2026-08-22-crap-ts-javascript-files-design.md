# crap-ts JavaScript source files

Status: ready-for-agent

## Problem Statement

v1 ignored `.js` / `.jsx` so crap-ts stayed a TypeScript-only tool. Mixed and JavaScript trees therefore have production Functions with no CRAP row. `.mjs` and `.cjs` are the same hole next to the TypeScript `.mts` / `.cts` variants.

## Solution

`crap-ts` analyzes `.js`, `.jsx`, `.mjs`, and `.cjs` on every run, the same way it already analyzes `.ts`, `.tsx`, `.mts`, and `.cts`. No new flag. Path-fragments and `--changed` follow that analyzable set. Empty selection says `No source files to analyze.` Help, README, SKILL.md, and the package description say TypeScript and JavaScript where they mean the file set or what is scored. Function extraction, Coverage join, CRAP, and the default Vitest coverage command do not change.

## User Stories

1. As a TypeScript developer, I want `.js` files scored, so that mixed and JavaScript trees are not invisible.
2. As a TypeScript developer, I want `.jsx` files scored, so that JavaScript React sources are not invisible.
3. As a TypeScript developer, I want `.mjs` files scored, so that ESM JavaScript is not a hole next to `.mts`.
4. As a TypeScript developer, I want `.cjs` files scored, so that CommonJS JavaScript is not a hole next to `.cts`.
5. As a TypeScript developer, I want those extensions analyzed on every run with no new flag, so that I do not have to opt in.
6. As a TypeScript developer, I want `.ts`, `.tsx`, `.mts`, and `.cts` still analyzed, so that this slice only widens the file set.
7. As a TypeScript developer, I want `foo.ts` and `foo.js` in the same directory both scored, so that a sibling file is not dropped by a heuristic.
8. As a TypeScript developer, I want a path-fragment that matches a JavaScript path to keep that file, so that filters use the same substring rule as today.
9. As a TypeScript developer, I want `--source-root` pointing at a `.js` file to analyze that file, so that a file root is not TypeScript-only.
10. As a TypeScript developer, I want `--changed` to score a dirty `.js` / `.jsx` / `.mjs` / `.cjs` file, so that `--changed` uses the same analyzable-file rules as a full run.
11. As a TypeScript developer, I want `node_modules`, `dist`, `build`, `coverage`, `.git`, and `target` still skipped, so that emit and dependencies stay out.
12. As a TypeScript developer, I want `foo.test.js`, `foo.spec.jsx`, and `__tests__/` still skipped, so that test files stay out regardless of extension.
13. As a TypeScript developer, I want `.d.ts`, `.d.mts`, and `.d.cts` still skipped, so that declaration files stay out.
14. As a TypeScript developer, I want an empty file set without `--json` to print `No source files to analyze.` and exit 0, so that the sentence matches the widened file set.
15. As an agent, I want an empty file set with `--json` to still print `[]` plus a newline and exit 0, so that stdout stays a JSON array.
16. As a TypeScript developer, I want an empty file set not to run Coverage, so that a filter that matches nothing stays cheap.
17. As a TypeScript developer, I want `--help` to say it scores TypeScript and JavaScript Functions, so that the tagline matches the file set.
18. As a TypeScript developer, I want the `--changed` help line to say git-dirty TypeScript and JavaScript files, so that the flag is not described as TypeScript-only.
19. As a TypeScript developer, I want the path-fragment help line to say matching TypeScript and JavaScript files, so that arguments are not described as TypeScript-only.
20. As a TypeScript developer, I want README’s analyzed-extensions list to include `.js`, `.jsx`, `.mjs`, and `.cjs`, so that humans can see the file set.
21. As a TypeScript developer, I want README tagline, usage, and `--changed` copy to say TypeScript and JavaScript where they mean the file set or what is scored, so that the human docs match the CLI.
22. As an agent, I want SKILL.md’s YAML description, heading, setup, usage comment, `--changed` flag line, and How It Works step 2 to say TypeScript and JavaScript and list the new extensions, so that agents do not think only TypeScript files are scored.
23. As a TypeScript developer, I want the package description to say TypeScript and JavaScript Functions, so that npm copy matches the file set.
24. As a TypeScript developer, I want CONTEXT.md’s opening sentence to say TypeScript and JavaScript functions, so that the glossary intro matches the file set.
25. As a TypeScript developer, I want Function extraction unchanged, so that a JavaScript file is scored with the same Function kinds and names as a TypeScript file.
26. As a TypeScript developer, I want `module.exports = function foo() {}` still named `exports`, so that CommonJS is not a special naming rule.
27. As a TypeScript developer, I want a `.js` file the existing parser accepts (including type annotations or JSX) to be scored, so that this slice does not invent a stricter JavaScript parse.
28. As a TypeScript developer, I want a `.jsx` file with JSX to be scored, so that ScriptKind for `.jsx` still extracts Functions.
29. As a TypeScript developer, I want a real syntax error in a JavaScript file (`function {`) to exit 1 with the existing parse-error message, so that broken input is still not silently skipped.
30. As a TypeScript developer, I want `--json` and the table to show the same JavaScript Functions, so that format stays orthogonal to discovery.
31. As a TypeScript developer, I want Coverage join unchanged, so that an LCOV path ending in `foo.js` still suffix-matches the source path.
32. As a TypeScript developer, I want the default coverage command to remain Vitest emitting LCOV, so that auto-detecting Jest vs Vitest vs c8 stays parked.
33. As a TypeScript developer, I want `--threshold` unchanged, so that the Quality gate is orthogonal to the file set.
34. As a maintainer, I want tests at the `run` and `cli` seams, so that discovery, empty selection, `--changed`, and help copy cannot drift from this spec.

## Implementation Decisions

- No sixth module (v1 layout). No `functions` / `crap` / `coverage` change. `run` widens the analyzable extension list; `cli` updates help copy. Coverage join, CRAP, table, JSON, exit codes, and the default coverage command are unchanged.
- Analyzable extensions: `.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.jsx`, `.mjs`, `.cjs`. Skip directories, test-file patterns, and declaration-file skips are unchanged. Path-fragments and `--changed` keep using that same analyzable-file filter — a dirty `.js` is kept; a dirty `foo.test.js` is still dropped.
- Always-on. No `--js` flag and no sibling-stem heuristic. If `foo.ts` and `foo.js` both exist under a source root, both are analyzed.
- Empty selection without `--json` writes `No source files to analyze.` plus a newline and returns 0. Empty selection with `--json` still writes `[]` plus a newline. Neither path runs Coverage.
- Parser stays TypeScript 5 as a single source file: no program, no typecheck, no tsconfig. `createSourceFile` already takes the path, so ScriptKind stays extension-based (`.js` / `.mjs` / `.cjs` → JS, `.jsx` → JSX). Do not add a stricter JavaScript parse. Real syntax errors still fail as today.
- Function kinds and names are unchanged. `module.exports = function foo() {}` stays `exports` (property name). Do not special-case CommonJS.
- Help tagline, `--changed` line, and path-fragment line say TypeScript and JavaScript (not TypeScript-only). README tagline, usage, `--changed` copy, and analyzed-extensions list match. SKILL.md YAML description, heading, setup, usage, `--changed` flag line, and How It Works step 2 match and list the new extensions. Package description says TypeScript and JavaScript Functions.
- Glossary: Function in `CONTEXT.md` is unchanged. The opening sentence says TypeScript and JavaScript functions. No ADR.
- Do not rewrite the v1, JSON, `--changed`, object-literal, or let/var spec files.
- Binary stays `crap-ts`. Package stays `@mquesada02/crap-ts`.

## Testing Decisions

- Test external behaviour at `run` (discovered files, empty selection, `--changed`, parse error, report rows) and `cli` (help copy). Fixtures and return values; do not snapshot discovery internals. No `functions` / `crap` / `coverage` tests for this slice.
- Replace the current fixtures that assert a `.js` `--source-root` file is ignored and that a tree of only `.js` plus tests/skip-dirs is an empty selection. A `.js` `--source-root` file must be analyzed. A tree that contains only skip-dirs, tests, and declaration files is still empty; a production `.js` in that tree is a row.
- Cover: each new extension (`.js`, `.jsx`, `.mjs`, `.cjs`) produces a Function row; `.ts` still does; `foo.ts` and `foo.js` both appear; path-fragment `foo.js` keeps that file; `--changed` porcelain with a dirty `.js` scores it; `--changed` dirty `foo.test.js` is dropped; skip-dirs unchanged; empty selection string is `No source files to analyze.\n`; empty `--json` is still `[]\n` and does not run Coverage; help contains TypeScript and JavaScript on the tagline, `--changed` line, and path-fragment line; `.jsx` with JSX extracts; a `.js` file with type annotations is scored (exit 0); a `.js` file with JSX is scored (exit 0); `function {` in a `.js` file still exits 1. Existing exact-equality empty-selection assertions update to the new sentence.
- Prior art: existing `run` host injection (including `--changed` porcelain fixtures and the ignored-`.js` cases) and `cli` help-mentions-`--json` / `--changed` tests.

## Out of Scope

- A `--js` flag or other opt-in
- Skipping `.js` when a sibling `.ts` / `.tsx` exists
- Special-casing CommonJS names (`module.exports = function foo() {}` stays `exports`)
- A stricter JavaScript parse than `createSourceFile` already performs
- Walking constructor, getter, or setter bodies
- Loop-header bindings
- Destructuring bindings
- Binding lookup, merge / last-write-wins, or chain-walking assignment
- Assignment operators other than `=`, `||=`, `&&=`, `??=`
- Auto-detecting Jest vs Vitest vs c8
- Changing the default coverage command
- Configurable Decision-point sets
- Counting default parameters or destructuring defaults
- Full typecheck / tsconfig program
- CI-required Quality gate
- Maven-style multi-module grouping
- Mutation testing
- Function-level `--changed` (hunk join)
- Changing Function extraction, Coverage join, CRAP formula, table layout, JSON shape, or exit codes
- A new CLI flag
- npm publish / version bump (only when the user says **publish**)

## Further Notes

Carves analyzing `.js` / `.jsx` out of v1’s parked list, and includes `.mjs` / `.cjs` so ESM/CJS JavaScript matches `.mts` / `.cts`. Formula, report shape, Coverage join, Function kinds, and TypeScript 5.9.3 parser are unchanged. Package remains `@mquesada02/crap-ts`; binary `crap-ts`.
