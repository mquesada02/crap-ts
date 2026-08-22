import * as ts from "typescript";

export type ExtractedFunction = {
  name: string;
  namespace: string;
  startLine: number;
  endLine: number;
  complexity: number;
};

export function extractFunctions(
  source: string,
  filePath: string,
): ExtractedFunction[] {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  if (parseErrors(sourceFile).length > 0) {
    throw new Error(`failed to parse ${filePath}`);
  }
  const functions: ExtractedFunction[] = [];

  function visit(node: ts.Node, enclosingName: string | undefined): void {
    if (isNamedFunctionDeclaration(node)) {
      const name = qualify(enclosingName, node.name.text);
      functions.push(toFunction(node, name, filePath, sourceFile));
      ts.forEachChild(node.body, (child) => visit(child, name));
      return;
    }
    if (ts.isVariableStatement(node) && isLetVarOrConstList(node.declarationList)) {
      for (const decl of node.declarationList.declarations) {
        if (decl.initializer === undefined) {
          continue;
        }
        if (!ts.isIdentifier(decl.name)) {
          visit(decl.initializer, enclosingName);
          continue;
        }
        if (isFunctionLike(decl.initializer)) {
          const name = qualify(enclosingName, decl.name.text);
          functions.push(
            toFunction(decl.initializer, name, filePath, sourceFile),
          );
          ts.forEachChild(decl.initializer, (child) => visit(child, name));
          continue;
        }
        if (ts.isClassExpression(decl.initializer)) {
          visitClass(decl.initializer, enclosingName, decl.name.text);
          continue;
        }
        visit(decl.initializer, enclosingName);
      }
      return;
    }
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      visitClass(node, enclosingName, undefined);
      return;
    }
    if (ts.isObjectLiteralExpression(node)) {
      visitObjectLiteral(node, enclosingName);
      return;
    }
    if (ts.isBinaryExpression(node)) {
      if (visitAssignment(node, enclosingName)) {
        return;
      }
    }
    ts.forEachChild(node, (child) => visit(child, enclosingName));
  }

  function visitClass(
    node: ts.ClassDeclaration | ts.ClassExpression,
    enclosingName: string | undefined,
    fallbackName: string | undefined,
  ): void {
    const typeName = node.name?.text ?? fallbackName;
    if (typeName === undefined) {
      return;
    }
    for (const member of node.members) {
      if (!ts.isMethodDeclaration(member) || member.body === undefined) {
        continue;
      }
      const name = qualify(
        enclosingName,
        `${typeName}.${member.name.getText(sourceFile)}`,
      );
      functions.push(toFunction(member, name, filePath, sourceFile));
      ts.forEachChild(member.body, (child) => visit(child, name));
    }
  }

  function visitAssignment(
    node: ts.BinaryExpression,
    enclosingName: string | undefined,
  ): boolean {
    if (
      !isFunctionAssignmentOperator(node.operatorToken.kind) ||
      !isFunctionLike(node.right)
    ) {
      return false;
    }
    if (!isFunctionAssignmentTarget(node.left)) {
      return false;
    }
    const name = qualify(enclosingName, assignedName(node.left, sourceFile));
    functions.push(toFunction(node.right, name, filePath, sourceFile));
    ts.forEachChild(node.right, (child) => visit(child, name));
    return true;
  }

  function visitObjectLiteral(
    node: ts.ObjectLiteralExpression,
    enclosingName: string | undefined,
  ): void {
    for (const prop of node.properties) {
      if (
        ts.isGetAccessorDeclaration(prop) ||
        ts.isSetAccessorDeclaration(prop)
      ) {
        continue;
      }
      if (ts.isMethodDeclaration(prop) && prop.body !== undefined) {
        if (isObjectLiteralConstructor(prop)) {
          continue;
        }
        const name = qualify(enclosingName, prop.name.getText(sourceFile));
        functions.push(toFunction(prop, name, filePath, sourceFile));
        ts.forEachChild(prop.body, (child) => visit(child, name));
        continue;
      }
      if (ts.isPropertyAssignment(prop) && isFunctionLike(prop.initializer)) {
        const name = qualify(enclosingName, prop.name.getText(sourceFile));
        functions.push(toFunction(prop.initializer, name, filePath, sourceFile));
        ts.forEachChild(prop.initializer, (child) => visit(child, name));
        continue;
      }
      visit(prop, enclosingName);
    }
  }

  visit(sourceFile, undefined);
  return functions;
}

function qualify(enclosingName: string | undefined, name: string): string {
  return enclosingName === undefined ? name : `${enclosingName}.${name}`;
}

function isLetVarOrConstList(list: ts.VariableDeclarationList): boolean {
  const flags = list.flags;
  if ((flags & ts.NodeFlags.Using) !== 0) {
    return false;
  }
  return (
    (flags & ts.NodeFlags.Let) !== 0 ||
    (flags & ts.NodeFlags.Const) !== 0 ||
    flags === ts.NodeFlags.None
  );
}

function isFunctionLike(
  node: ts.Expression,
): node is ts.ArrowFunction | ts.FunctionExpression {
  return ts.isArrowFunction(node) || ts.isFunctionExpression(node);
}

const FUNCTION_ASSIGNMENT_OPERATORS = new Set([
  ts.SyntaxKind.EqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
]);

function isFunctionAssignmentOperator(kind: ts.SyntaxKind): boolean {
  return FUNCTION_ASSIGNMENT_OPERATORS.has(kind);
}

function isFunctionAssignmentTarget(
  left: ts.Expression,
): left is
  | ts.Identifier
  | ts.PropertyAccessExpression
  | ts.ElementAccessExpression {
  return (
    ts.isIdentifier(left) ||
    ts.isPropertyAccessExpression(left) ||
    ts.isElementAccessExpression(left)
  );
}

function assignedName(
  left:
    | ts.Identifier
    | ts.PropertyAccessExpression
    | ts.ElementAccessExpression,
  sourceFile: ts.SourceFile,
): string {
  if (ts.isIdentifier(left)) {
    return left.text;
  }
  if (ts.isPropertyAccessExpression(left)) {
    return left.name.getText(sourceFile);
  }
  return `[${left.argumentExpression.getText(sourceFile)}]`;
}

function isObjectLiteralConstructor(prop: ts.MethodDeclaration): boolean {
  return ts.isIdentifier(prop.name) && prop.name.text === "constructor";
}

function toFunction(
  node: ts.Node,
  name: string,
  filePath: string,
  sourceFile: ts.SourceFile,
): ExtractedFunction {
  return {
    name,
    namespace: filePath,
    startLine: lineOf(sourceFile, node.getStart(sourceFile)),
    endLine: lineOf(sourceFile, node.end),
    complexity: complexityOf(node),
  };
}

function complexityOf(root: ts.Node): number {
  let complexity = 1;
  function walk(current: ts.Node): void {
    if (current !== root && isOwnRowRoot(current)) {
      return;
    }
    if (isDecisionPoint(current)) {
      complexity++;
    }
    ts.forEachChild(current, walk);
  }
  walk(root);
  return complexity;
}

const DECISION_STATEMENT_KINDS = new Set([
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.DoStatement,
  ts.SyntaxKind.CaseClause,
  ts.SyntaxKind.DefaultClause,
  ts.SyntaxKind.CatchClause,
  ts.SyntaxKind.ConditionalExpression,
]);

const LOGICAL_OPERATORS = new Set([
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
]);

function isDecisionPoint(node: ts.Node): boolean {
  if (DECISION_STATEMENT_KINDS.has(node.kind)) {
    return true;
  }
  if (ts.isBinaryExpression(node)) {
    return LOGICAL_OPERATORS.has(node.operatorToken.kind);
  }
  return (
    (ts.isPropertyAccessExpression(node) ||
      ts.isElementAccessExpression(node) ||
      ts.isCallExpression(node)) &&
    node.questionDotToken !== undefined
  );
}

function isNamedFunctionDeclaration(
  node: ts.Node,
): node is ts.FunctionDeclaration & { name: ts.Identifier; body: ts.Block } {
  return (
    ts.isFunctionDeclaration(node) &&
    node.name !== undefined &&
    node.body !== undefined
  );
}

function isOwnRowRoot(node: ts.Node): boolean {
  if (isNamedFunctionDeclaration(node)) {
    return true;
  }
  if (ts.isMethodDeclaration(node) && node.body !== undefined) {
    return true;
  }
  if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
    return true;
  }
  return (
    (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) &&
    (isLetVarOrConstBound(node) ||
      isFunctionValuedProperty(node) ||
      isAssignedFunction(node))
  );
}

function isFunctionValuedProperty(node: ts.Node): boolean {
  const parent = node.parent;
  return (
    parent !== undefined &&
    ts.isPropertyAssignment(parent) &&
    parent.initializer === node
  );
}

function isAssignedFunction(node: ts.Node): boolean {
  const parent = node.parent;
  return (
    parent !== undefined &&
    ts.isBinaryExpression(parent) &&
    isFunctionAssignmentOperator(parent.operatorToken.kind) &&
    parent.right === node &&
    isFunctionAssignmentTarget(parent.left)
  );
}

function isLetVarOrConstBound(node: ts.Node): boolean {
  const parent = node.parent;
  if (
    parent === undefined ||
    !ts.isVariableDeclaration(parent) ||
    parent.initializer !== node ||
    !ts.isIdentifier(parent.name)
  ) {
    return false;
  }
  const list = parent.parent;
  return (
    ts.isVariableDeclarationList(list) &&
    isLetVarOrConstList(list) &&
    ts.isVariableStatement(list.parent)
  );
}

function lineOf(sourceFile: ts.SourceFile, pos: number): number {
  return sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
}

function parseErrors(sourceFile: ts.SourceFile): readonly ts.Diagnostic[] {
  return (
    sourceFile as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }
  ).parseDiagnostics;
}
