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
    if (ts.isVariableStatement(node) && isConstList(node.declarationList)) {
      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || decl.initializer === undefined) {
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

  visit(sourceFile, undefined);
  return functions;
}

function qualify(enclosingName: string | undefined, name: string): string {
  return enclosingName === undefined ? name : `${enclosingName}.${name}`;
}

function isConstList(list: ts.VariableDeclarationList): boolean {
  return (list.flags & ts.NodeFlags.Const) !== 0;
}

function isFunctionLike(
  node: ts.Expression,
): node is ts.ArrowFunction | ts.FunctionExpression {
  return ts.isArrowFunction(node) || ts.isFunctionExpression(node);
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

function isDecisionPoint(node: ts.Node): boolean {
  if (
    ts.isIfStatement(node) ||
    ts.isForStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node) ||
    ts.isCaseClause(node) ||
    ts.isDefaultClause(node) ||
    ts.isCatchClause(node) ||
    ts.isConditionalExpression(node)
  ) {
    return true;
  }
  if (ts.isBinaryExpression(node)) {
    switch (node.operatorToken.kind) {
      case ts.SyntaxKind.AmpersandAmpersandToken:
      case ts.SyntaxKind.BarBarToken:
      case ts.SyntaxKind.QuestionQuestionToken:
      case ts.SyntaxKind.AmpersandAmpersandEqualsToken:
      case ts.SyntaxKind.BarBarEqualsToken:
      case ts.SyntaxKind.QuestionQuestionEqualsToken:
        return true;
      default:
        return false;
    }
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
    isConstBound(node)
  );
}

function isConstBound(node: ts.Node): boolean {
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
  return ts.isVariableDeclarationList(list) && isConstList(list);
}

function lineOf(sourceFile: ts.SourceFile, pos: number): number {
  return sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
}

function parseErrors(sourceFile: ts.SourceFile): readonly ts.Diagnostic[] {
  return (
    sourceFile as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }
  ).parseDiagnostics;
}
