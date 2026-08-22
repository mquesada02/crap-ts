# crap-ts let/var bindings and identifier assignment Functions

Status: ready-for-agent

## Problem Statement

TypeScript production Functions are often bound with `let` or `var` (`let foo = () => {}`) or written later (`foo = () => {}`, `foo ||= () => {}`). v1 scored only `const` bindings. Object-literal scoring left those bindings parked, and property assignment scored only `=`. That risk is invisible.

## Solution

`crap-ts` extracts `let`/`var` identifier bindings whose initializer is a function or arrow as Functions, the same way `const` already does. It also extracts a function or arrow assigned to an identifier (`foo = () => {}`) in already-walked scopes, and it extracts `||=` / `&&=` / `??=` writes of a function or arrow to an identifier or a property. Report names follow existing binding and property-assignment rules. No new CLI flag. Constructor, getter, and setter bodies stay unwalked. Loop-header bindings and destructuring bindings stay not Functions.

## User Stories

1. As a TypeScript developer, I want `let foo = () => {}` to be a Function named `foo`, so that `let` bindings are scored the same way as `const foo = () => {}`.
2. As a TypeScript developer, I want `var foo = () => {}` to be a Function named `foo`, so that `var` is not a hole next to `let` and `const`.
3. As a TypeScript developer, I want `let foo = function () {}` and `var foo = function () {}` to be Functions named `foo`, so that function expressions match arrows.
4. As a TypeScript developer, I want `export let foo = () => {}` and `export var foo = () => {}` to be Functions named `foo`, so that an export keyword does not hide the binding.
5. As a TypeScript developer, I want `let foo = function helper() {}` named `foo`, so that the binding name wins over the inner function name, matching `const foo = function helper() {}`.
6. As a TypeScript developer, I want `let foo = otherFn` not to be a Function, so that a reference is not a second row for a Function defined elsewhere.
7. As a TypeScript developer, I want `let foo = () => {}, bar = () => {}` to be two Functions named `foo` and `bar`, so that a mixed declarator list does not hide a binding.
8. As a TypeScript developer, I want an enclosing Function to prefix a nested `let`/`var` binding (`parent.foo`, `Widget.run.foo`), so that nesting matches existing nested named Functions.
9. As a TypeScript developer, I want `foo = () => {}` and `foo = function () {}` to be Functions named `foo` in already-walked scopes, so that a later write is scored without looking up a `let`/`var` binding.
10. As a TypeScript developer, I want `foo ||= () => {}`, `foo &&= () => {}`, and `foo ??= () => {}` to be Functions named `foo`, so that logical assignment is not a hole next to `=`.
11. As a TypeScript developer, I want `foo.bar ||= () => {}`, `foo.bar &&= () => {}`, and `foo.bar ??= () => {}` to be Functions named `bar` (bracket writes still `[key]`, `['bar']`, `[1]`), so that property writes use the same operators as identifier writes.
12. As a TypeScript developer, I want `foo = otherFn` and `foo.bar ||= otherFn` not to be Functions, so that a reference is not a row.
13. As a TypeScript developer, I want `let foo = () => {}; foo = () => {}` to be two Functions both named `foo` (different line ranges), so that reassignment is not merged and last-write does not win.
14. As a TypeScript developer, I want two later writes (`foo = () => {}; foo = () => {}`) to be two rows, so that each write is its own Function.
15. As a TypeScript developer, I want `foo = bar = () => {}` and `let foo = bar = () => {}` to extract `bar` only, so that a chained assignment does not alias a row onto `foo`.
16. As a TypeScript developer, I want `let X = class { m() {} }` and `var X = class { m() {} }` to extract `X.m`, so that unnamed class expressions get the same binding fallback as `const X = class { m() {} }`.
17. As a TypeScript developer, I want `let Y = class Named { n() {} }` to extract `Named.n`, so that a class’s own name still wins over the binding.
18. As a TypeScript developer, I want constructor, getter, and setter bodies left unwalked, so that `let foo = () => {}`, `foo = () => {}`, and `this.bar ||= () => {}` inside a constructor stay invisible.
19. As a TypeScript developer, I want `for (let fn = () => {}; …)` and `for (const fn = () => {}; …)` not to be Functions, so that loop-header bindings stay out.
20. As a TypeScript developer, I want `foo = () => {}` inside a loop body to still be a Function, so that parking loop-header bindings does not hide an identifier write in a walked scope.
21. As a TypeScript developer, I want `let { foo } = { foo: () => {} }` and `let [foo] = [() => {}]` not to mint a Function from the binding name, so that destructuring stays identifier-only.
22. As a TypeScript developer, I want `{ foo: () => {} }` in that object-literal RHS to still extract `foo`, so that parking destructuring does not undo object-literal Functions.
23. As a TypeScript developer, I want the array-element arrow in `let [foo] = [() => {}]` not to be a Function, so that it stays an anonymous callback like any other array-element function or arrow.
24. As a TypeScript developer, I want `let`/`var` bindings and identifier/property assignment Functions to be own rows, so that their Decision points are not double-counted on a parent.
25. As a TypeScript developer, I want a parent that only contains `let foo = () => { if (x) {} }` to have CC 1 while `foo` has CC 2, so that `let`/`var` bindings stop the parent CC walk the same way `const` already does.
26. As a TypeScript developer, I want a parent that only contains `foo = () => { if (x) {} }` to have CC 1 while `foo` has CC 2, so that the assigned function/arrow stops the parent CC walk.
27. As a TypeScript developer, I want a parent that only contains `foo ||= () => { if (x) {} }` to have CC 2 while `foo` has CC 2, so that `||=` still counts as a Decision point on the parent and the assigned function/arrow is its own row.
28. As a TypeScript developer, I want a parent that only contains `foo.bar ||= () => { if (x) {} }` to have CC 2 while `bar` has CC 2, so that property logical assignment matches identifier logical assignment for CC.
29. As a TypeScript developer, I want a mixed `let a = b && c, helper = () => 1` list inside a parent to count `&&` on the parent and extract `helper` as its own row, so that mixed declarator lists match existing `const` behaviour.
30. As a TypeScript developer, I want `let api = { run() {} }` to still extract `run`, so that object-literal Functions are unchanged when the object is `let`-bound.
31. As a TypeScript developer, I want `async` and generator `let`/`var` bindings extracted like any other Function, so that v1 spelling rules hold.
32. As a TypeScript developer, I want `--json` and the table to show the same new names, so that format stays orthogonal to extraction.
33. As an agent, I want SKILL.md’s “Extracts Functions” list to mention `let`/`var` bindings and identifier assignments (including logical assignment to identifiers and properties), so that agents do not think only `const` bindings and `=` property writes are scored.
34. As a maintainer, I want tests at the `functions` seam, so that extraction and CC cannot drift from this spec.

## Implementation Decisions

- No sixth module (v1 layout). No `cli` / `run` / `crap` / `coverage` change. `functions` extraction grows; Coverage join, CRAP, table, JSON, `--changed`, and exit codes are unchanged.
- Parser stays TypeScript 5 as a single source file: no program, no typecheck, no tsconfig. No binding lookup for identifier writes.
- A Function additionally includes: a `let` or `var` identifier binding whose initializer is a function or arrow expression (same rules as `const`: identifier name only; initializer must be the function or arrow, not a reference); a function or arrow expression assigned to an identifier with `=`, `||=`, `&&=`, or `??=` in already-walked scopes; a function or arrow expression assigned to a property with `||=`, `&&=`, or `??=` (property `=` writes already ship). `async` and generator spellings follow v1.
- A `let` or `var` identifier bound to an unnamed class expression uses that binding as the class Function prefix, matching `const`. A class expression with its own name still uses that name.
- Not a Function: constructors, getters, setters, anonymous callbacks, anonymous `export default function`, a binding or write whose value is not a function or arrow expression (`let foo = otherFn`, `foo = otherFn`), destructuring bindings, loop-header bindings, an array-element function or arrow (`let [foo] = [() => {}]`), assignment operators other than `=`, `||=`, `&&=`, `??=`.
- Do not add walks of constructor, getter, or setter bodies. Assignment Functions appear only where the walker already visits (module scope, Function bodies, class Function bodies, including loop bodies already visited there). Loop-header `let`/`var`/`const` bindings stay out; `export let` / `export var` statements still count.
- Report name: binding and identifier-write names are the identifier text (`foo`), prefixed only by the enclosing Function (`parent.foo`, `Widget.run.foo`). Property logical assignment keeps the shipped property-assignment names (`bar`; `[key]`, `['bar']`, `[1]`). Class instance/static Functions stay `Type.name`.
- Own rows: `let`/`var` bindings, identifier assignment Functions, and property logical-assignment Functions are nested named Functions for CC. The enclosing Function’s CC walk must stop at the function or arrow. A logical-assignment operator sits outside that function or arrow, so it still counts on the enclosing Function when one exists.
- Line range follows v1: the function or arrow node (the initializer or the assignment RHS), not the `let`/`var`/`const` keyword and not the assignment expression.
- Reassignment is two rows with the same report name and different line ranges. Chained assignment (`foo = bar = () => {}`) extracts only the write whose RHS is the function or arrow (`bar`).
- Glossary: Function in `CONTEXT.md` already includes `const`/`let`/`var`-bound function/arrow and a function/arrow assigned to a property or identifier. No ADR.
- Do not rewrite the v1, JSON, `--changed`, or object-literal spec files.
- SKILL.md how-it-works step 3 lists `let`/`var` bindings and identifier assignments (and logical assignment to identifiers and properties). README has no Function-kind list today; do not add a section.

## Testing Decisions

- Test external behaviour at `functions` (`extractFunctions` names, complexity, line range). Fixtures are source strings. Do not snapshot walker internals. No `cli` / `run` / `crap` / `coverage` tests for this slice.
- Replace the current names-only fixture that asserts `let foo = () => {}` is not a row. That case must extract `foo`, and `let api = { run() {} }` must still extract `run`.
- Cover: `let` arrow; `var` arrow; `let`/`var` function expression; `export let` / `export var`; `let foo = function helper() {}` named `foo`; `let foo = otherFn` not a row; mixed declarator list; nested prefix; identifier `=`; identifier `||=` / `&&=` / `??=`; property `||=` / `&&=` / `??=` named like shipped `=` writes; `foo = otherFn` not a row; two rows for `let foo = () => {}; foo = () => {}`; two later writes; chained assignment extracts `bar` only; `let X = class { m() {} }` → `X.m`; `let Y = class Named { n() {} }` → `Named.n`; no row from constructor `let` / identifier write / `this.bar ||=`; no row from `for (let fn = () => {})`; identifier write inside a loop body is a row; destructuring binding not a row while object-literal `foo` still is; array-element arrow not a row; parent CC vs child CC for `let` binding, identifier `=`, identifier `||=`, and property `||=`; mixed `let` list `&&` on the parent; enclosing-Function prefix; `async`/`generator` `let` bindings; line range on the function or arrow.
- Prior art: existing `functions` fixture tests for `const` bindings, class-expression fallback, nested named Functions, mixed `const` lists, object-literal Functions, property `=` assignment, and the parked `let foo = () => {}` names-only case.

## Out of Scope

- Walking constructor, getter, or setter bodies (`let foo = () => {}` / `foo = () => {}` / `this.bar ||= () => {}` in a constructor stays invisible)
- Loop-header bindings (`for (let fn = () => {}; …)`)
- Destructuring bindings (`let { foo } = { foo: () => {} }`)
- Binding lookup to decide which identifier writes count
- Merging or last-write-wins for reassignment
- Chain-walking so `foo = bar = () => {}` also extracts `foo`
- Assignment operators other than `=`, `||=`, `&&=`, `??=`
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

Carves `let`/`var` function bindings out of v1’s parked list, and includes identifier assignment of functions/arrows plus logical assignment (`||=`, `&&=`, `??=`) to identifiers and properties in already-walked scopes. Java CRAP has no `let`/`var` analog. Formula, report shape, Coverage join, and TypeScript 5.9.3 parser are unchanged. Package remains `@mquesada02/crap-ts`; binary `crap-ts`.
