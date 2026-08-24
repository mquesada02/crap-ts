# crap-ts constructor, getter, and setter Functions

Status: ready-for-agent

## Problem Statement

v1 treated constructors, getters, and setters as not Functions, and later slices left their bodies unwalked. A constructor `if`, a getter branch, `this.bar = () => {}`, `let foo = () => {}`, and nested `function helper()` inside those members therefore get no report row (or, for object-literal getters, their Decision points land on an enclosing Function that is not that getter). That risk is invisible or attributed to the wrong Function. Boilerplate is not a reason to hide a named production Function that actually branches.

## Solution

`crap-ts` extracts class constructors, getters, and setters, and object-literal `constructor()` methods, getters, and setters, as Functions. They get their own report rows. Their own Decision points count on those rows. Nested production Functions inside them are nested Functions of that row. Class constructor names are `Type.constructor` (`Widget.constructor`). Object-literal `constructor()` is `constructor` — a method named `constructor`, not a JS `new` constructor. Accessors mark `get` / `set` in the name (`Widget.get hidden`, `Widget.set hidden`, `get x`, `set x`; computed `Widget.get [key]`, `get [key]`). Nested names use the existing enclosing-Function prefix (`Widget.constructor.helper`, `Widget.constructor.bar`). Empty constructors, getters, and setters are CC 1. `super()`, parameter properties, default parameters, and bodyless overloads follow existing Function rules. No new CLI flag. Loop-header bindings and destructuring stay parked.

## User Stories

1. As a TypeScript developer, I want a class `constructor()` to be a Function named `Widget.constructor`, so that constructor risk is scored like any other class Function.
2. As a TypeScript developer, I want an empty class constructor, empty getter, empty setter, and empty object-literal `constructor()` / `get` / `set` to be rows with CC 1, so that they follow empty class Functions (`run() {}`) instead of a boilerplate exception.
3. As a TypeScript developer, I want Decision points in the constructor body that are not inside a nested Function to count on `Widget.constructor`, so that `if (!ready) throw` is not invisible.
4. As a TypeScript developer, I want `this.bar = () => {}` inside a class constructor to be a Function named `Widget.constructor.bar`, so that a property assignment in a constructor is not a hole.
5. As a TypeScript developer, I want `let foo = () => {}`, `foo = () => {}`, and `this.bar ||= () => {}` inside a class constructor to be Functions (`Widget.constructor.foo`, `Widget.constructor.foo`, `Widget.constructor.bar`), so that let/var and assignment extraction apply where the walker now visits.
6. As a TypeScript developer, I want nested `function helper()` inside a class constructor to be a Function named `Widget.constructor.helper`, so that a named nested Function is not hidden.
7. As a TypeScript developer, I want object-literal `constructor()` to be a Function named `constructor`, so that a method named `constructor` is not skipped only because of its name and is not treated as a JS `new` constructor.
8. As a TypeScript developer, I want that object-literal constructor nested in an enclosing Function to be `parent.constructor`, so that enclosing-Function prefix still applies.
9. As a TypeScript developer, I want `this.bar = () => {}` and nested `function helper()` inside an object-literal constructor to be `constructor.bar` / `constructor.helper` (or `parent.constructor.bar` / `parent.constructor.helper` when nested), so that body walks match class constructors.
10. As a TypeScript developer, I want a class getter to be a Function named `Widget.get hidden`, so that getter risk is scored and the row is not a bare `Widget.hidden`.
11. As a TypeScript developer, I want a class setter to be a Function named `Widget.set hidden`, so that setter risk is scored and get vs set are distinct rows.
12. As a TypeScript developer, I want `get hidden` and `set hidden` on the same class to be two Functions, so that get and set are not one row.
13. As a TypeScript developer, I want object-literal `get x()` and `set x()` to be Functions named `get x` and `set x`, so that object-literal accessors match class accessors without a type prefix.
14. As a TypeScript developer, I want computed, quoted, and numeric accessor names to keep the name’s source text after `get` / `set` (`Widget.get [key]`, `get [key]`, `Widget.get "x"`, `get 1`), so that spelling rules match object-literal methods.
15. As a TypeScript developer, I want a static getter or setter to stay `Widget.get hidden` / `Widget.set hidden` with no extra `static` prefix, so that static accessors match static Functions.
16. As a TypeScript developer, I want a class Function nested in an enclosing Function to keep the enclosing prefix (`parent.Widget.constructor`, `parent.Widget.get hidden`), so that nested classes match existing `parent.Widget.run`.
17. As a TypeScript developer, I want `const X = class { constructor() {} }` to extract `X.constructor`, so that unnamed class expressions keep the binding fallback.
18. As a TypeScript developer, I want `const Y = class Named { constructor() {} }` to extract `Named.constructor`, so that the class’s own name still wins.
19. As a TypeScript developer, I want anonymous-callback Decision points inside a constructor, getter, or setter to count on that Function, so that `map` arrows in a constructor still affect its CRAP.
20. As a TypeScript developer, I want a nested Function’s Decision points not counted on the constructor, getter, or setter, so that CRAP is not double-counted.
21. As a TypeScript developer, I want `super(...)` not to add a Decision point, so that a constructor call is not treated as a branch.
22. As a TypeScript developer, I want constructor parameter properties not to be Functions, so that `constructor(private ready: boolean)` is one constructor row, not a field row.
23. As a TypeScript developer, I want default parameters on a constructor, getter, or setter not counted as Decision points, so that signatures do not inflate CC.
24. As a TypeScript developer, I want bodyless constructor overloads skipped and the implementation constructor extracted, so that overload signatures match bodyless Function declarations.
25. As a TypeScript developer, I want bodyless getters and setters skipped (abstract or ambient), so that a missing body is not a row.
26. As a TypeScript developer, I want a private or protected constructor to still be a Function named `Widget.constructor`, so that visibility does not hide the Function.
27. As a TypeScript developer, I want constructors, getters, and setters in `.js` / `.jsx` / `.mjs` / `.cjs` extracted the same way, so that JavaScript files do not reintroduce the hole.
28. As a TypeScript developer, I want `async` getters extracted like any other Function with no extra `async` name prefix, so that `async get x()` is still `Widget.get x`.
29. As a TypeScript developer, I want a parent Function that only contains an object-literal getter/setter with a branch to have CC 1 while the accessor has CC 2, so that accessor Decision points no longer land on the parent.
30. As a TypeScript developer, I want a constructor that only contains `this.bar = () => { if (x) {} }` to have CC 1 while `Widget.constructor.bar` has CC 2, so that nested assignment Functions stop the constructor CC walk.
31. As a TypeScript developer, I want `--json` and the table to show the same new names, so that format stays orthogonal to extraction.
32. As a TypeScript developer, I want `--changed` and `--changed-functions` to include these rows automatically, so that selection flags do not need a new extract path.
33. As an agent, I want SKILL.md’s “Extracts Functions” list to mention constructors, getters, and setters (and the `get` / `set` name spelling), so that agents do not think those members are still skipped.
34. As a maintainer, I want tests at the `functions` seam, so that extraction, names, and CC cannot drift from this spec.

## Implementation Decisions

- No sixth module (v1 layout). No `cli` / `run` / `crap` / `coverage` change. `functions` extraction grows; Coverage join, CRAP, table, JSON, `--changed`, `--changed-functions`, and exit codes are unchanged.
- Parser stays TypeScript 5 as a single source file: no program, no typecheck, no tsconfig.
- A Function additionally includes: a class constructor with a body; a class getter or setter with a body (instance or static); an object-literal method named `constructor` with a body (not a JS `new` constructor); an object-literal getter or setter with a body. `async` getters are extracted like any other Function (no extra `async` name prefix). Empty constructors, getters, and setters are CC 1.
- Not a Function: anonymous callbacks, anonymous `export default function`, a property whose value is not a function or arrow expression, parameter properties, bodyless overloads / abstract / ambient members, static initialization blocks, loop-header bindings, destructuring bindings.
- Report name: class constructor is `Type.constructor` (binding fallback for unnamed class expressions, own name when the class has one), prefixed only by an enclosing Function. Object-literal `constructor()` is the property name `constructor`, prefixed only by an enclosing Function. Class accessors are `Type.get <name>` and `Type.set <name>` where `<name>` is the accessor name’s source text (identifier, quoted, numeric, computed, private). Object-literal accessors are `get <name>` and `set <name>`. Do not use `Type.get.name` (that looks like a nested Function). Do not add a `static` prefix. Nested production Functions prefix with that enclosing Function (`Widget.constructor.helper`, `Widget.constructor.bar`, `parent.constructor.bar`).
- Own rows: constructors, getters, and setters with bodies are nested named Functions for CC. The enclosing Function’s CC walk must stop at them. Nested Functions inside them stop their CC walk the same way as inside a class method. Anonymous-callback Decision points count on the constructor / getter / setter.
- `super(...)` is a call, not a Decision point. Default parameters and destructuring defaults stay uncounted. Parameter properties are not extra Functions. Line range is the constructor / getter / setter member (same as a class method), not the body alone.
- Glossary: Function in `CONTEXT.md` already includes class constructors, getters, setters, and object-literal methods (including `constructor()`), getters, and setters, and no longer excludes constructor, getter, or setter. No ADR.
- Do not rewrite the v1, JSON, `--changed`, object-literal, let/var, JavaScript-files, or `--changed-functions` spec files.
- SKILL.md how-it-works step 3 lists constructors, getters, and setters and the `get` / `set` name spelling. README has no Function-kind list today; do not add a section.

## Testing Decisions

- Test external behaviour at `functions` (`extractFunctions` names, complexity, line range). Fixtures are source strings. Do not snapshot walker internals. No `cli` / `run` / `crap` / `coverage` tests for this slice.
- Replace the fixtures that lock the old skip: constructors/getters/setters are not rows; object-literal constructor with `this.bar = () => {}` and nested `function helper()`; class constructor assignment `this.bar = () => {}`; constructor `let` / identifier write / `this.bar ||=`. Those cases must extract the constructor/getter/setter and the nested production Functions. Keep skipping anonymous callbacks and anonymous default exports.
- Cover: empty class constructor CC 1 named `Widget.constructor`; empty class getter/setter and empty object-literal `constructor()` / `get` / `set` CC 1; constructor-own `if` on that row; `this.bar` / `let foo` / identifier write / `this.bar ||=` / nested `function helper` inside a class constructor with enclosing prefix; the same nested production Functions inside class and object-literal getters/setters; object-literal `constructor()` named `constructor` plus nested `bar` / `helper`; class `get` / `set` names with the accessor mark and two rows for the same property; object-literal `get x` / `set x`; computed / quoted accessor names; static accessor with no extra `static` prefix; `parent.Widget.constructor`; `const X = class { constructor() {} }` → `X.constructor`; `const Y = class Named { constructor() {} }` → `Named.constructor`; anonymous-callback Decision points on the constructor; nested Function Decision points not on the constructor; `super()` does not add CC; parameter properties are not extra rows; default parameters uncounted; bodyless constructor overload skipped; bodyless getter and setter skipped; private constructor still a row; parent CC vs child CC for an object-literal getter and for a constructor nested assignment Function; enclosing-Function prefix for object-literal constructor and accessors; `async` getter; line range on the member.
- Prior art: existing `functions` fixture tests for class `Type.name`, nested named Functions, skipped constructors/getters/setters, object-literal constructor skip, constructor assignment skip, constructor let/var skip, parent CC vs child CC, and class-expression binding fallback.

## Out of Scope

- Loop-header bindings (`for (let fn = () => {}; …)`)
- Destructuring bindings, binding lookup, merge / last-write-wins, chain-walking assignment
- Assignment operators other than `=`, `||=`, `&&=`, `??=`
- Prefixing object or assignment Functions with the object binding (`api.run`) or a nested object path (`nested.run`)
- Extracting static initialization blocks as Functions
- Auto-detecting Jest vs Vitest vs c8
- Configurable Decision-point sets
- Counting `super()` as a Decision point
- Counting default parameters or destructuring defaults
- Full typecheck / tsconfig program
- CI-required Quality gate
- Maven-style multi-module grouping
- Mutation testing
- Comparing `--changed` / `--changed-functions` to `main` or a pull-request base
- A new CLI flag
- Changing Coverage join, CRAP formula, table layout, JSON shape, or exit codes
- npm publish / version bump (only when the user says **publish**)

## Further Notes

Reverses v1 story 26: constructors, getters, and setters are Functions. Java CRAP already treats constructors as methods; this slice matches that for TypeScript and JavaScript, and includes getters and setters because they are named production Functions with bodies. Formula, report shape, Coverage join, and TypeScript 5.9.3 parser are unchanged. Package remains `@mquesada02/crap-ts`; binary `crap-ts`.
