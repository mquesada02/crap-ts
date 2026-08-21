# crap-ts object-literal and assignment Functions

Status: ready-for-agent

## Problem Statement

TypeScript production APIs are often object literals (`const api = { run() {} }`, `{ run: () => {} }`) and property assignments (`foo.bar = () => {}`). v1 parked those, so they get no report row. Object-literal method shorthand is the same node kind as a class Function, so its Decision points also vanish from the enclosing Function instead of counting anywhere. That risk is invisible.

## Solution

`crap-ts` extracts object-literal methods, function-valued properties, and function/arrow property assignments as Functions. They get their own report rows. Report names are the property name’s source text, prefixed only by an enclosing Function (`run`, `parent.run`, `[key]`). Identifier assignment writes are `bar`; bracket assignment writes are `[key]`, `['bar']`, `[1]`. Nested object paths and object bindings are not prefixes (`nested.run` and `api.run` are wrong). Class Functions stay `Type.name`. No new CLI flag. Constructors, getters, and setters stay not Functions; this slice does not start walking their bodies. `let` / `var` bindings stay parked.

## User Stories

1. As a TypeScript developer, I want `{ run() {} }` to be a Function, so that object-literal method shorthand is scored.
2. As a TypeScript developer, I want `{ run: () => {} }` and `{ run: function () {} }` to be Functions, so that function-valued properties are scored the same way as shorthand.
3. As a TypeScript developer, I want those properties to be Functions even when the object is unnamed (`foo({ run() {} })`, `return { run() {} }`, `export default { run() {} }`), so that a missing `const` binding does not hide a production Function.
4. As a TypeScript developer, I want identifier, quoted, numeric, and computed names to be Functions (`run`, `"run"`, `1`, `[key]`, `['run']`), so that the name’s spelling does not hide a row.
5. As a TypeScript developer, I want nested object literals walked (`{ nested: { run() {} } }` and `foo({ nested: { run() {} } })`), so that depth does not hide a Function.
6. As a TypeScript developer, I want the report name to be the property name’s source text (`run`, `[key]`, `"run"`), so that object Functions are not prefixed with a binding (`api.run`) or a nested object path (`nested.run`).
7. As a TypeScript developer, I want an enclosing Function to prefix that name (`parent.run`, `Widget.run.helper`), so that nesting matches existing nested named Functions.
8. As a TypeScript developer, I want class Functions to stay `Type.name` (`Widget.run`), so that this slice does not restyle class rows.
9. As a TypeScript developer, I want `{ run: function helper() {} }` named `run`, so that the property name wins over the inner function name, matching `const run = function helper() {}`.
10. As a TypeScript developer, I want `{ run: otherFn }` not to be a Function, so that a reference is not a second row for a Function defined elsewhere.
11. As a TypeScript developer, I want `foo.bar = () => {}` and `foo.bar = function () {}` to be Functions, so that assignment-style APIs are scored.
12. As a TypeScript developer, I want `foo[key] = () => {}`, `foo['bar'] = () => {}`, and `foo[1] = () => {}` to be Functions, so that computed, quoted, and numeric assignment targets are scored too.
13. As a TypeScript developer, I want those assignment Functions only in scopes already walked (module scope, Function bodies, class Function bodies, including object literals already visited there), so that this slice does not invent new body walks.
14. As a TypeScript developer, I want constructor, getter, and setter bodies left unwalked, so that `this.bar = () => {}` inside a constructor stays invisible and nested Functions inside constructors stay as in v1.
15. As a TypeScript developer, I want an assignment Function’s report name to be the property name’s source text (`bar` for `foo.bar`; `[key]`, `['bar']`, `[1]` for bracket writes), prefixed only by an enclosing Function, so that identifier writes stay bare and bracket writes match `{ [key]() {} }`.
16. As a TypeScript developer, I want object-literal and assignment Functions to be own rows, so that their Decision points are not double-counted on a parent.
17. As a TypeScript developer, I want a parent that only contains `{ run() { if (x) {} } }` to have CC 1 while `run` has CC 2, so that object-literal method shorthand Decision points no longer vanish.
18. As a TypeScript developer, I want a parent that only contains `{ run: () => { if (x) {} } }` to have CC 1 while `run` has CC 2, so that function-valued properties stop the parent CC walk the same way nested named Functions already do.
19. As a TypeScript developer, I want a parent that only contains `foo.bar = () => { if (x) {} }` or `foo.bar = function () { if (x) {} }` to have CC 1 while `bar` has CC 2, so that assignment Functions stop the parent CC walk too.
20. As a TypeScript developer, I want constructors, getters, and setters (class or object-literal) to remain not Functions, so that v1 boilerplate exclusions hold.
21. As a TypeScript developer, I want `--json` and the table to show the same new names, so that format stays orthogonal to extraction.
22. As a TypeScript developer, I want `let` / `var` function bindings to stay not Functions, so that parking those bindings is not silently undone. (`let api = { run() {} }` still extracts `run`, because `run` is an object-literal Function, not a `let`-bound function.)
23. As an agent, I want SKILL.md’s “Extracts Functions” list to mention object-literal methods, function-valued properties, and property assignments, so that agents do not think only declarations, class Functions, and `const` bindings are scored.
24. As a maintainer, I want tests at the `functions` seam, so that extraction and CC cannot drift from this spec.

## Implementation Decisions

- No sixth module (v1 layout). No `cli` / `run` / `crap` / `coverage` change. `functions` extraction grows; Coverage join, CRAP, table, JSON, `--changed`, and exit codes are unchanged.
- Parser stays TypeScript 5 as a single source file: no program, no typecheck, no tsconfig.
- A Function additionally includes: an object-literal method with a body; a function or arrow expression that is the value of an object-literal property; a function or arrow expression assigned to a property. Any name kind (identifier, string literal, numeric literal, computed). Nested object literals are visited. The object does not need a `const` binding. `async` and generator spellings follow v1 (extracted like any other Function).
- Not a Function: constructors, getters, setters, anonymous callbacks, anonymous `export default function`, `let` / `var` function bindings, a property whose value is not a function or arrow expression (`{ run: otherFn }`).
- Do not add walks of constructor, getter, or setter bodies. Assignment Functions appear only where the walker already visits.
- Report name: the property name’s source text (class computed Functions already use this for `Type.[key]`). For a computed, quoted, or numeric property write (`foo[key] =`, `foo['bar'] =`, `foo[1] =`), wrap the name’s source text in `[…]` so it matches `{ [key]() {} }`. Prefix only with the enclosing Function name. Do not prefix with the object binding (`api.run`) or a nested object path (`nested.run`). Class instance/static Functions stay `Type.name`.
- Own rows: object-literal and assignment Functions are nested named Functions for CC. The enclosing Function’s CC walk must stop at them. Object-literal method shorthand already stops that walk (same node kind as a class Function) — extraction must emit the row so those Decision points are not lost. Function-valued properties and assignment Functions must stop the walk too.
- Line range follows v1: the object-literal method, or the function/arrow node for a property value or assignment RHS (same as `const foo = () => {}` using the initializer, not the `const`).
- Glossary: Function in `CONTEXT.md` already includes object-literal methods, function-valued properties, and property assignments. No ADR.
- Do not rewrite the v1, JSON, or `--changed` spec files.
- SKILL.md how-it-works step 3 lists the new Function kinds. README has no Function-kind list today; do not add a section.

## Testing Decisions

- Test external behaviour at `functions` (`extractFunctions` names, complexity, line range). Fixtures are source strings. Do not snapshot walker internals. No `cli` / `run` / `crap` / `coverage` tests for this slice.
- Replace the current names-only fixture that asserts `const api = { run() {} }` inside `parent` is not a row. That case must extract `parent` and `parent.run`.
- Cover: object-literal method shorthand; `run: () => {}`; `run: function () {}`; unnamed objects; nested objects named `run` not `nested.run`; computed, quoted, and numeric names; `{ run: function helper() {} }` named `run`; `{ run: otherFn }` not a row; assignment `foo.bar =` named `bar`, `foo[key] =` named `[key]`, `foo['bar'] =` named `['bar']`, `foo[1] =` named `[1]`, at module scope and inside a Function and inside a class Function; no assignment row from a constructor body; parent CC vs child CC for object-literal method shorthand, function-valued properties, and assignment Functions (arrow and function expression); enclosing-Function prefix; class `Type.name` unchanged; `let api = { run() {} }` still extracts `run`; `let foo = () => {}` still does not.
- Prior art: existing `functions` fixture tests for class Functions, nested named Functions, anonymous-callback CC, and the parked object-literal names-only case.

## Out of Scope

- `let` / `var` function bindings (`let foo = () => {}`)
- Walking constructor, getter, or setter bodies (`this.bar = () => {}` in a constructor stays invisible)
- Prefixing object or assignment Functions with the object binding (`api.run`) or a nested object path (`nested.run`)
- Analyzing `.js` / `.jsx`
- Auto-detecting Jest vs Vitest vs c8
- Configurable Decision-point sets
- Counting default parameters or destructuring defaults
- Full typecheck / tsconfig program
- CI-required Quality gate
- Maven-style multi-module grouping
- Mutation testing
- Function-level `--changed` (hunk join)
- A new CLI flag
- Changing Coverage join, CRAP formula, table layout, JSON shape, or exit codes
- npm publish / version bump (only when the user says **publish**)

## Further Notes

Carves object-literal Functions and function-valued properties out of v1’s parked list, and includes property assignments of functions/arrows in already-walked scopes. Java CRAP has no object-literal analog. Formula, report shape, Coverage join, and TypeScript 5.9.3 parser are unchanged. Package remains `@mquesada02/crap-ts`; binary `crap-ts`.
