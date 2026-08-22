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

test("does not count a nested class Function's Decision points on the parent", () => {
  const extracted = extractFunctions(
    `
function process(x: boolean) {
  class Widget {
    run() {
      if (x) { return 1; }
      return 0;
    }
  }
}
`,
    "src/foo.ts",
  );
  expect(extracted.map((fn) => ({ name: fn.name, complexity: fn.complexity }))).toEqual([
    { name: "process", complexity: 1 },
    { name: "process.Widget.run", complexity: 2 },
  ]);
});

test("extracts an object-literal method as a Function", () => {
  const names = extractFunctions(
    "function parent() { const api = { run() {} }; }",
    "src/foo.ts",
  ).map((fn) => fn.name);
  expect(names).toEqual(["parent", "parent.run"]);
});

test("extracts function-valued properties as Functions", () => {
  const names = extractFunctions(
    "function parent() { const api = { run: () => {}, other: function () {} }; }",
    "src/foo.ts",
  ).map((fn) => fn.name);
  expect(names).toEqual(["parent", "parent.run", "parent.other"]);
});

test("extracts object-literal Functions on unnamed objects", () => {
  const names = extractFunctions(
    "function parent() { foo({ run() {} }); return { other: () => {} }; }",
    "src/foo.ts",
  ).map((fn) => fn.name);
  expect(names).toEqual(["parent", "parent.run", "parent.other"]);
});

test("extracts nested object-literal Functions as the property name", () => {
  const names = extractFunctions(
    "function parent() { const api = { nested: { run() {} } }; }",
    "src/foo.ts",
  ).map((fn) => fn.name);
  expect(names).toEqual(["parent", "parent.run"]);
});

test("names object-literal Functions from the property source text", () => {
  const names = extractFunctions(
    `const api = {
  run() {},
  "quoted"() {},
  1() {},
  [key]() {},
  ['computed']() {},
};`,
    "src/foo.ts",
  ).map((fn) => fn.name);
  expect(names).toEqual(["run", '"quoted"', "1", "[key]", "['computed']"]);
});

test("uses the property name over an inner function name", () => {
  const names = extractFunctions(
    "const api = { run: function helper() {} };",
    "src/foo.ts",
  ).map((fn) => fn.name);
  expect(names).toEqual(["run"]);
});

test("does not extract a property that references another Function", () => {
  const names = extractFunctions(
    "function otherFn() {} const api = { run: otherFn, get x() { return 1; } };",
    "src/foo.ts",
  ).map((fn) => fn.name);
  expect(names).toEqual(["otherFn"]);
});

test("does not extract object-literal constructors, getters, or setters", () => {
  const names = extractFunctions(
    `
function parent() {
  const api = {
    constructor() { this.bar = () => {}; function helper() {} },
    get x() { foo.nested = () => {}; return 1; },
    set x(v: number) { foo.set = () => {}; },
    run() {},
  };
}
`,
    "src/foo.ts",
  ).map((fn) => fn.name);
  expect(names).toEqual(["parent", "parent.run"]);
});

test("extracts a nested object-literal Function on an unnamed object", () => {
  const names = extractFunctions(
    "function parent() { foo({ nested: { run() {} } }); }",
    "src/foo.ts",
  ).map((fn) => fn.name);
  expect(names).toEqual(["parent", "parent.run"]);
});

test("extracts assignment Functions with property-name report names", () => {
  const names = extractFunctions(
    `
foo.bar = () => {};
foo[key] = () => {};
foo['bar'] = function () {};
foo[1] = () => {};
`,
    "src/foo.ts",
  ).map((fn) => fn.name);
  expect(names).toEqual(["bar", "[key]", "['bar']", "[1]"]);
});

test("extracts identifier-assignment Functions", () => {
  const extracted = extractFunctions(
    `foo = () => {};
foo = function () {};`,
    "src/foo.ts",
  );
  expect(
    extracted.map((fn) => ({
      name: fn.name,
      startLine: fn.startLine,
      endLine: fn.endLine,
    })),
  ).toEqual([
    { name: "foo", startLine: 1, endLine: 1 },
    { name: "foo", startLine: 2, endLine: 2 },
  ]);
});

test("extracts identifier logical-assignment Functions", () => {
  const names = extractFunctions(
    "foo ||= () => {}; bar &&= () => {}; baz ??= function () {};",
    "src/foo.ts",
  ).map((fn) => fn.name);
  expect(names).toEqual(["foo", "bar", "baz"]);
});

test("extracts property logical-assignment Functions", () => {
  const names = extractFunctions(
    "foo.bar ||= () => {}; foo[key] &&= () => {}; foo['bar'] ??= function () {}; foo[1] ||= () => {};",
    "src/foo.ts",
  ).map((fn) => fn.name);
  expect(names).toEqual(["bar", "[key]", "['bar']", "[1]"]);
});

test("prefixes assignment Functions with the enclosing Function", () => {
  const names = extractFunctions(
    `
function parent() { foo.bar = () => {}; foo = () => {}; }
class Widget { run() { this.helper = function () {}; helper = () => {}; } }
`,
    "src/foo.ts",
  ).map((fn) => fn.name);
  expect(names).toEqual([
    "parent",
    "parent.bar",
    "parent.foo",
    "Widget.run",
    "Widget.run.helper",
    "Widget.run.helper",
  ]);
});

test("does not extract an assignment Function from a constructor", () => {
  const names = extractFunctions(
    "class Widget { constructor() { this.bar = () => {}; } run() {} }",
    "src/foo.ts",
  ).map((fn) => fn.name);
  expect(names).toEqual(["Widget.run"]);
});

test("does not count object-literal Decision points on the parent", () => {
  expect(
    extractFunctions(
      "function parent(x: boolean) { const api = { run() { if (x) { return 1; } } }; }",
      "src/foo.ts",
    ).map((fn) => ({ name: fn.name, complexity: fn.complexity })),
  ).toEqual([
    { name: "parent", complexity: 1 },
    { name: "parent.run", complexity: 2 },
  ]);
  expect(
    extractFunctions(
      "function parent(x: boolean) { const api = { run: () => { if (x) { return 1; } } }; }",
      "src/foo.ts",
    ).map((fn) => ({ name: fn.name, complexity: fn.complexity })),
  ).toEqual([
    { name: "parent", complexity: 1 },
    { name: "parent.run", complexity: 2 },
  ]);
  expect(
    extractFunctions(
      "function parent(x: boolean) { const api = { run: function () { if (x) { return 1; } } }; }",
      "src/foo.ts",
    ).map((fn) => ({ name: fn.name, complexity: fn.complexity })),
  ).toEqual([
    { name: "parent", complexity: 1 },
    { name: "parent.run", complexity: 2 },
  ]);
});

test("does not count identifier-assignment Decision points on the parent", () => {
  expect(
    extractFunctions(
      "function parent(x: boolean) { foo = () => { if (x) { return 1; } }; }",
      "src/foo.ts",
    ).map((fn) => ({ name: fn.name, complexity: fn.complexity })),
  ).toEqual([
    { name: "parent", complexity: 1 },
    { name: "parent.foo", complexity: 2 },
  ]);
});

test("counts identifier logical-assignment as a parent Decision point", () => {
  expect(
    extractFunctions(
      "function parent(x: boolean) { foo ||= () => { if (x) { return 1; } }; }",
      "src/foo.ts",
    ).map((fn) => ({ name: fn.name, complexity: fn.complexity })),
  ).toEqual([
    { name: "parent", complexity: 2 },
    { name: "parent.foo", complexity: 2 },
  ]);
});

test("counts property logical-assignment as a parent Decision point", () => {
  expect(
    extractFunctions(
      "function parent(x: boolean) { foo.bar ||= () => { if (x) { return 1; } }; }",
      "src/foo.ts",
    ).map((fn) => ({ name: fn.name, complexity: fn.complexity })),
  ).toEqual([
    { name: "parent", complexity: 2 },
    { name: "parent.bar", complexity: 2 },
  ]);
});

test("prefixes a nested let-bound Function inside a class Function", () => {
  const names = extractFunctions(
    "class Widget { run() { let foo = () => {}; } }",
    "src/foo.ts",
  ).map((fn) => fn.name);
  expect(names).toEqual(["Widget.run", "Widget.run.foo"]);
});

test("does not count let-bound Decision points on the parent", () => {
  expect(
    extractFunctions(
      "function parent(x: boolean) { let foo = () => { if (x) { return 1; } }; }",
      "src/foo.ts",
    ).map((fn) => ({ name: fn.name, complexity: fn.complexity })),
  ).toEqual([
    { name: "parent", complexity: 1 },
    { name: "parent.foo", complexity: 2 },
  ]);
});

test("counts Decision points in a mixed let list on the enclosing Function", () => {
  expect(
    extractFunctions(
      "function parent(b: boolean, c: boolean) { let a = b && c, helper = () => 1; return a; }",
      "src/foo.ts",
    ).map((fn) => ({ name: fn.name, complexity: fn.complexity })),
  ).toEqual([
    { name: "parent", complexity: 2 },
    { name: "parent.helper", complexity: 1 },
  ]);
});

test("extracts async and generator let-bound Functions", () => {
  const names = extractFunctions(
    "let foo = async () => {}; let bar = async function* () {}; var gen = function* () {};",
    "src/foo.ts",
  ).map((fn) => fn.name);
  expect(names).toEqual(["foo", "bar", "gen"]);
});

test("extracts each Function in a mixed let declarator list", () => {
  const names = extractFunctions(
    "let foo = () => {}, bar = () => {};",
    "src/foo.ts",
  ).map((fn) => fn.name);
  expect(names).toEqual(["foo", "bar"]);
});

test("extracts let and var function-expression and export Functions", () => {
  const names = extractFunctions(
    `
export let exported = () => {};
export var also = function () {};
let foo = function helper() {};
var bar = function () {};
`,
    "src/foo.ts",
  ).map((fn) => fn.name);
  expect(names).toEqual(["exported", "also", "foo", "bar"]);
});

test("does not extract a let or assignment Function that references another Function", () => {
  const names = extractFunctions(
    "function otherFn() {} let foo = otherFn; bar = otherFn; baz.qux ||= otherFn;",
    "src/foo.ts",
  ).map((fn) => fn.name);
  expect(names).toEqual(["otherFn"]);
});

test("extracts chained assignment from the Function write only", () => {
  const names = extractFunctions(
    "foo = bar = () => {}; let baz = qux = function () {};",
    "src/foo.ts",
  ).map((fn) => fn.name);
  expect(names).toEqual(["bar", "qux"]);
});

test("extracts let and var class-expression Functions with binding fallback", () => {
  const names = extractFunctions(
    `
let X = class { m() {} };
var Y = class { n() {} };
let Z = class Named { p() {} };
`,
    "src/foo.ts",
  ).map((fn) => fn.name);
  expect(names).toEqual(["X.m", "Y.n", "Named.p"]);
});

test("counts loop-header arrow Decision points on the enclosing Function", () => {
  expect(
    extractFunctions(
      "function parent(x: boolean) { for (let fn = () => { if (x) { return 1; } }; false; ) {} }",
      "src/foo.ts",
    ).map((fn) => ({ name: fn.name, complexity: fn.complexity })),
  ).toEqual([{ name: "parent", complexity: 3 }]);
});

test("does not extract loop-header bindings or destructuring bindings", () => {
  const names = extractFunctions(
    `
function parent() {
  for (let fn = () => {}; false; ) {}
  for (const gn = () => {}; false; ) {}
  let { foo } = { foo: () => {} };
  let [bar] = [() => {}];
}
`,
    "src/foo.ts",
  ).map((fn) => fn.name);
  expect(names).toEqual(["parent", "parent.foo"]);
});

test("extracts an identifier-assignment Function inside a loop body", () => {
  const names = extractFunctions(
    "function parent() { for (let i = 0; i < 1; i++) { foo = () => {}; } }",
    "src/foo.ts",
  ).map((fn) => fn.name);
  expect(names).toEqual(["parent", "parent.foo"]);
});

test("does not extract let or identifier-assignment Functions from a constructor", () => {
  const names = extractFunctions(
    "class Widget { constructor() { let foo = () => {}; foo = () => {}; this.bar ||= () => {}; } run() {} }",
    "src/foo.ts",
  ).map((fn) => fn.name);
  expect(names).toEqual(["Widget.run"]);
});

test("extracts two Function rows for a let binding and a later write", () => {
  const extracted = extractFunctions(
    `let foo = () => {};
foo = () => {};`,
    "src/foo.ts",
  );
  expect(
    extracted.map((fn) => ({
      name: fn.name,
      startLine: fn.startLine,
      endLine: fn.endLine,
    })),
  ).toEqual([
    { name: "foo", startLine: 1, endLine: 1 },
    { name: "foo", startLine: 2, endLine: 2 },
  ]);
});

test("records line range of a let-bound Function", () => {
  const [fn] = extractFunctions(
    `let foo =
  () => {
    return 1;
  };`,
    "src/foo.ts",
  );
  expect(fn).toMatchObject({ name: "foo", startLine: 2, endLine: 4 });
});

test("does not count assignment Function Decision points on the parent", () => {
  expect(
    extractFunctions(
      "function parent(x: boolean) { foo.bar = () => { if (x) { return 1; } }; }",
      "src/foo.ts",
    ).map((fn) => ({ name: fn.name, complexity: fn.complexity })),
  ).toEqual([
    { name: "parent", complexity: 1 },
    { name: "parent.bar", complexity: 2 },
  ]);
  expect(
    extractFunctions(
      "function parent(x: boolean) { foo.bar = function () { if (x) { return 1; } }; }",
      "src/foo.ts",
    ).map((fn) => ({ name: fn.name, complexity: fn.complexity })),
  ).toEqual([
    { name: "parent", complexity: 1 },
    { name: "parent.bar", complexity: 2 },
  ]);
});

test("extracts a var-bound arrow Function", () => {
  const names = extractFunctions("var foo = () => 1;", "src/foo.ts").map(
    (fn) => fn.name,
  );
  expect(names).toEqual(["foo"]);
});

test("extracts object-literal Functions from a let object and let-bound Functions", () => {
  const names = extractFunctions(
    "let api = { run() {} }; let foo = () => {};",
    "src/foo.ts",
  ).map((fn) => fn.name);
  expect(names).toEqual(["run", "foo"]);
});

test("records line range of the object-literal method and assignment Function", () => {
  const extracted = extractFunctions(
    `const api = {
  run() {
    return 1;
  }
};
foo.bar = () => {
  return 1;
};`,
    "src/foo.ts",
  );
  expect(
    extracted.map((fn) => ({
      name: fn.name,
      startLine: fn.startLine,
      endLine: fn.endLine,
    })),
  ).toEqual([
    { name: "run", startLine: 2, endLine: 4 },
    { name: "bar", startLine: 6, endLine: 8 },
  ]);
});
