/**
 * Constants Ignore Utilities
 *
 * Handles ignore comments for the constants analyzer
 */

import { Node } from 'ts-morph';

const IGNORE_NEXT_LINE_PATTERN = /constants-ignore-next-line/;
const IGNORE_BLOCK_START_PATTERN = /constants-ignore-start/;
const IGNORE_BLOCK_END_PATTERN = /constants-ignore-end/;

export function hasIgnoreNextLineComment(node: Node): boolean {
  try {
    const sourceFile = node.getSourceFile();
    const nodeStart = node.getStart();
    const fullText = sourceFile.getFullText();
    const textBefore = fullText.substring(0, nodeStart);
    const lines = textBefore.split('\n');

    if (lines.length >= 2 && IGNORE_NEXT_LINE_PATTERN.test(lines[lines.length - 2])) {
      return true;
    }
    if (IGNORE_NEXT_LINE_PATTERN.test(lines[lines.length - 1])) {
      return true;
    }
  } catch {
    // If we can't determine, don't ignore
  }
  return false;
}

export function buildIgnoreBlocks(fileText: string): Array<{ start: number; end: number }> {
  const lines = fileText.split('\n');
  const ignoreBlocks: Array<{ start: number; end: number }> = [];
  let currentBlockStart: number | null = null;

  lines.forEach((lineText, index) => {
    const lineNumber = index + 1;
    if (IGNORE_BLOCK_START_PATTERN.test(lineText)) {
      currentBlockStart = lineNumber;
    } else if (IGNORE_BLOCK_END_PATTERN.test(lineText) && currentBlockStart !== null) {
      ignoreBlocks.push({ start: currentBlockStart, end: lineNumber });
      currentBlockStart = null;
    }
  });

  return ignoreBlocks;
}

export function isInIgnoreBlock(
  line: number,
  ignoreBlocks: Array<{ start: number; end: number }>
): boolean {
  return ignoreBlocks.some((block) => line >= block.start && line <= block.end);
}
