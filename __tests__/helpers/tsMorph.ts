/**
 * Shared test helpers for building ts-morph nodes from source strings.
 */

import { Project, SourceFile, SyntaxKind, Node } from 'ts-morph';

/**
 * Create an in-memory ts-morph SourceFile from a code string. No disk access,
 * so it's fast and isolated — ideal for exercising the scanner/detection logic.
 */
export function createSourceFile(code: string, fileName = 'test.ts'): SourceFile {
  const project = new Project({ useInMemoryFileSystem: true });
  return project.createSourceFile(fileName, code);
}

/**
 * Return the first descendant node of the given kind, or throw if none exists.
 * Keeps detection-context tests terse and intention-revealing.
 */
export function firstOfKind(code: string, kind: SyntaxKind): Node {
  const file = createSourceFile(code);
  const node = file.getFirstDescendantByKind(kind);
  if (!node) {
    throw new Error(`No node of kind ${SyntaxKind[kind]} found in: ${code}`);
  }
  return node;
}
