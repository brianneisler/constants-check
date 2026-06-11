/**
 * Type Detection Utilities for Constants Analyzer
 */

import { Node, SyntaxKind } from 'ts-morph';

const TYPE_CONTEXT_KINDS = new Set([
  SyntaxKind.TypeAliasDeclaration,
  SyntaxKind.InterfaceDeclaration,
  SyntaxKind.TypeLiteral,
  SyntaxKind.LiteralType,
  SyntaxKind.UnionType,
  SyntaxKind.IntersectionType,
  SyntaxKind.TypeReference,
  SyntaxKind.TypeParameter,
  SyntaxKind.IndexedAccessType,
  SyntaxKind.MappedType,
  SyntaxKind.ConditionalType,
  SyntaxKind.TypeQuery,
  SyntaxKind.TypeOperator,
  SyntaxKind.EnumDeclaration,
  SyntaxKind.EnumMember,
]);

const TYPE_SIGNATURE_KINDS = new Set([
  SyntaxKind.PropertySignature,
  SyntaxKind.MethodSignature,
  SyntaxKind.IndexSignature,
  SyntaxKind.CallSignature,
  SyntaxKind.ConstructSignature,
]);

const PARAM_PROPERTY_KINDS = new Set([SyntaxKind.Parameter, SyntaxKind.PropertyDeclaration]);

const TYPE_LITERAL_PARENT_KINDS = new Set([
  SyntaxKind.TypeLiteral,
  SyntaxKind.InterfaceDeclaration,
]);

const TYPEOF_SENTINEL_STRINGS = new Set([
  'string',
  'number',
  'boolean',
  'object',
  'undefined',
  'function',
  'symbol',
  'bigint',
]);

export function isTypeLiteral(node: Node): boolean {
  let current: Node | undefined = node;

  while (current) {
    const kind = current.getKind();

    if (TYPE_CONTEXT_KINDS.has(kind) || TYPE_SIGNATURE_KINDS.has(kind)) {
      return true;
    }

    if (PARAM_PROPERTY_KINDS.has(kind)) {
      const parent = current.getParent();
      if (parent && TYPE_LITERAL_PARENT_KINDS.has(parent.getKind())) {
        return true;
      }
    }

    current = current.getParent();
  }

  return false;
}

export function isTypeofSentinel(node: Node, text: string): boolean {
  if (!TYPEOF_SENTINEL_STRINGS.has(text)) {
    return false;
  }

  const parent = node.getParent();
  if (Node.isBinaryExpression(parent)) {
    const left = parent.getLeft();
    const right = parent.getRight();

    if (Node.isTypeOfExpression(left) || Node.isTypeOfExpression(right)) {
      return true;
    }
  }

  return false;
}

export function isImportOrExport(node: Node): boolean {
  const parent = node.getParent();
  const isImport = Node.isImportDeclaration(parent) || Node.isImportSpecifier(parent);
  const isExport = Node.isExportDeclaration(parent) || Node.isExportSpecifier(parent);
  const isExternalModule = Node.isExternalModuleReference(parent);
  return isImport || isExport || isExternalModule || isModuleSpecifierArgument(node);
}

/**
 * Detects module specifier literals passed to dynamic `import('...')` or
 * `require('...')` calls. These are module paths, not reusable constants, so
 * they should never be reported as duplicate literals.
 */
function isModuleSpecifierArgument(node: Node): boolean {
  const parent = node.getParent();
  if (!Node.isCallExpression(parent)) {
    return false;
  }

  // The literal must be the (first) call argument, not some other position.
  if (parent.getArguments()[0] !== node) {
    return false;
  }

  const expression = parent.getExpression();

  // Dynamic import: import('...')
  if (expression.getKind() === SyntaxKind.ImportKeyword) {
    return true;
  }

  // CommonJS require: require('...')
  return Node.isIdentifier(expression) && expression.getText() === 'require';
}

export function isPropertyKey(node: Node): boolean {
  const parent = node.getParent();
  if (Node.isPropertyAssignment(parent)) {
    return parent.getNameNode() === node;
  }
  return false;
}

export function isLikelyArrayIndex(node: Node): boolean {
  const parent = node.getParent();
  if (!Node.isElementAccessExpression(parent)) {
    return false;
  }
  const argumentExpression = parent.getArgumentExpression();
  if (argumentExpression === undefined) {
    return false;
  }
  return (
    argumentExpression.getStart() === node.getStart() &&
    argumentExpression.getEnd() === node.getEnd()
  );
}
