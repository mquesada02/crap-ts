# CRAP for TypeScript

A CLI that scores TypeScript functions by combining cyclomatic complexity with test coverage, so the riskiest code to change is visible.

## Language

**Function**:
A named production callable that receives one report row: a function declaration, a class method (instance or static), or a `const`-bound function/arrow, at module, class, or nested scope. Not an anonymous callback, constructor, getter, setter, or test.
_Avoid_: method, callable, unit, symbol

**CRAP**:
The Change Risk Anti-Pattern score of a Function: `CC² × (1 − coverage)³ + CC`. A high score means the Function is both complex and under-tested.
_Avoid_: risk score, quality score

**Decision point**:
A branch in a Function: `if`, loop, `switch` case, `catch`, ternary, `&&`, `||`, `??`, `?.`, or logical assignment (`||=`, `&&=`, `??=`). Not a default parameter or destructuring default. A nested Function's branches belong to that Function. An anonymous callback's branches belong to the enclosing Function.
_Avoid_: predicate, control-flow node

**Quality gate**:
An optional local check that fails the process when the worst numeric CRAP exceeds a threshold. Off by default; not a CI requirement.
_Avoid_: CI gate, fail-on-crap

**Coverage**:
The fraction of a Function's executable lines hit by tests, taken from LCOV. Unknown coverage is N/A, not zero.
_Avoid_: instruction coverage, branch coverage, form coverage
