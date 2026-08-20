import { expect, test } from "vitest";
import { extractFunctions } from "./functions.js";

test("extracts a function declaration with CC 1", () => {
  const [fn] = extractFunctions("function foo() { return 1; }", "src/foo.ts");
  expect(fn).toMatchObject({
    name: "foo",
    namespace: "src/foo.ts",
    complexity: 1,
  });
});

test("records inclusive 1-based line range", () => {
  const [fn] = extractFunctions(
    `function foo() {
  return 1;
}`,
    "src/foo.ts",
  );
  expect(fn).toMatchObject({ startLine: 1, endLine: 3 });
});

test("extracts a class instance Function as Type.name", () => {
  const [fn] = extractFunctions(
    "class Widget { run() { return 1; } }",
    "src/widget.ts",
  );
  expect(fn).toMatchObject({
    name: "Widget.run",
    namespace: "src/widget.ts",
    complexity: 1,
  });
});

test("extracts a const-bound arrow Function", () => {
  const [fn] = extractFunctions(
    "const foo = () => 1;",
    "src/foo.ts",
  );
  expect(fn).toMatchObject({ name: "foo", complexity: 1 });
});

test("prefixes a nested named Function with its enclosing Function", () => {
  const extracted = extractFunctions(
    `
function process() {
  function helper() { return 1; }
}
`,
    "src/foo.ts",
  );
  expect(extracted.map((fn) => fn.name)).toEqual(["process", "process.helper"]);
});

test("counts if as a Decision point", () => {
  const [fn] = extractFunctions(
    "function foo(x: boolean) { if (x) { return 1; } return 0; }",
    "src/foo.ts",
  );
  expect(fn?.complexity).toBe(2);
});

test("does not count a nested Function's Decision points on the parent", () => {
  const extracted = extractFunctions(
    `
function process(x: boolean) {
  function helper(y: boolean) {
    if (y) { return 1; }
    return 0;
  }
  return helper(x);
}
`,
    "src/foo.ts",
  );
  expect(extracted.map((fn) => ({ name: fn.name, complexity: fn.complexity }))).toEqual([
    { name: "process", complexity: 1 },
    { name: "process.helper", complexity: 2 },
  ]);
});

function complexityOfBody(body: string): number | undefined {
  return extractFunctions(`function foo() { ${body} }`, "src/foo.ts")[0]
    ?.complexity;
}

test("counts for as a Decision point", () => {
  expect(complexityOfBody("for (;;) {}")).toBe(2);
});

test("counts for-in as a Decision point", () => {
  expect(complexityOfBody("for (const k in {}) {}")).toBe(2);
});

test("counts for-of as a Decision point", () => {
  expect(complexityOfBody("for (const x of []) {}")).toBe(2);
});

test("counts for-await-of as a Decision point", () => {
  expect(
    extractFunctions(
      "async function foo() { for await (const x of []) {} }",
      "src/foo.ts",
    )[0]?.complexity,
  ).toBe(2);
});

test("counts while as a Decision point", () => {
  expect(complexityOfBody("while (false) {}")).toBe(2);
});

test("counts do-while as a Decision point", () => {
  expect(complexityOfBody("do {} while (false);")).toBe(2);
});

test("counts each switch case and default as a Decision point", () => {
  expect(
    complexityOfBody("switch (0) { case 1: break; case 2: break; default: break; }"),
  ).toBe(4);
});

test("counts catch as a Decision point", () => {
  expect(complexityOfBody("try {} catch { }")).toBe(2);
});

test("counts ternary as a Decision point", () => {
  expect(complexityOfBody("return true ? 1 : 0;")).toBe(2);
});

test("counts && || ?? as Decision points", () => {
  expect(complexityOfBody("return a && b || c;")).toBe(3);
  expect(complexityOfBody("return a ?? b;")).toBe(2);
});

test("counts each optional chain as a Decision point", () => {
  expect(complexityOfBody("return obj?.x?.y?.[0]?.();")).toBe(5);
});

test("counts logical assignment as a Decision point", () => {
  expect(complexityOfBody("a ||= b; a &&= b; a ??= b;")).toBe(4);
});

test("does not count else, default parameters, or destructuring defaults", () => {
  expect(complexityOfBody("if (true) {} else {}")).toBe(2);
  expect(
    extractFunctions("function foo(x = 1, { y = 2 } = {}) { return x; }", "src/foo.ts")[0]
      ?.complexity,
  ).toBe(1);
});

test("skips constructors, getters, setters, anonymous callbacks, and anonymous default exports", () => {
  const names = extractFunctions(
    `
class Widget {
  constructor() {}
  get x() { return 1; }
  set x(v: number) {}
  run() {}
  static create() {}
}
export default function () {}
function parent() {
  [].map((x) => x);
}
`,
    "src/foo.ts",
  ).map((fn) => fn.name);
  expect(names).toEqual(["Widget.run", "Widget.create", "parent"]);
});

test("extracts const-bound function expressions and class-expression Functions", () => {
  const names = extractFunctions(
    `
const fn = function () { return 1; };
const X = class { m() {} };
const Y = class Named { n() {} };
`,
    "src/foo.ts",
  ).map((fn) => fn.name);
  expect(names).toEqual(["fn", "X.m", "Named.n"]);
});

test("counts anonymous-callback Decision points on the enclosing Function", () => {
  expect(
    extractFunctions(
      "function parent() { return [].map((x) => (x ? 1 : 0)); }",
      "src/foo.ts",
    ).map((fn) => ({ name: fn.name, complexity: fn.complexity })),
  ).toEqual([{ name: "parent", complexity: 2 }]);
});

test("does not count Decision-point keywords inside comments or strings", () => {
  expect(
    complexityOfBody(
      `const s = "if && || ?? ?. "; // if for while
/* catch case default */
return 1;`,
    ),
  ).toBe(1);
});

test("extracts a nested named Function inside a const callback initializer", () => {
  const names = extractFunctions(
    "function parent() { const x = f(function () { function helper() {} }); }",
    "src/foo.ts",
  ).map((fn) => fn.name);
  expect(names).toEqual(["parent", "parent.helper"]);
});

test("prefixes a nested const-bound Function", () => {
  const names = extractFunctions(
    "function process() { const helper = () => 1; }",
    "src/foo.ts",
  ).map((fn) => fn.name);
  expect(names).toEqual(["process", "process.helper"]);
});

test("prefixes a helper nested in a class Function", () => {
  const names = extractFunctions(
    "class Widget { run() { function helper() {} } }",
    "src/widget.ts",
  ).map((fn) => fn.name);
  expect(names).toEqual(["Widget.run", "Widget.run.helper"]);
});

test("skips bodyless Function declarations", () => {
  const names = extractFunctions(
    `
function foo(x: number): number;
function foo(x: number) { return x; }
declare function bar(): void;
`,
    "src/foo.ts",
  ).map((fn) => fn.name);
  expect(names).toEqual(["foo"]);
});

test("counts Decision points in a mixed const list on the enclosing Function", () => {
  expect(
    extractFunctions(
      "function parent(b: boolean, c: boolean) { const a = b && c, helper = () => 1; return a; }",
      "src/foo.ts",
    ).map((fn) => ({ name: fn.name, complexity: fn.complexity })),
  ).toEqual([
    { name: "parent", complexity: 2 },
    { name: "parent.helper", complexity: 1 },
  ]);
});

test("extracts a named export default function and a generator", () => {
  const names = extractFunctions(
    `
export default function named() { return 1; }
function* gen() { yield 1; }
`,
    "src/foo.ts",
  ).map((fn) => fn.name);
  expect(names).toEqual(["named", "gen"]);
});

test("does not count yield as a Decision point", () => {
  expect(
    extractFunctions("function* gen() { yield 1; }", "src/foo.ts")[0]?.complexity,
  ).toBe(1);
});

test("parses tsx as a single source file", () => {
  const [fn] = extractFunctions(
    "export function Box() { return <div/>; }",
    "src/box.tsx",
  );
  expect(fn).toMatchObject({ name: "Box", namespace: "src/box.tsx", complexity: 1 });
});
