/**
 * Constants Ignore Utilities
 *
 * Handles ignore comments for the constants analyzer
 */

import type { Node } from 'ts-morph';
import { fileLinesOf } from './fileLines.js';

const IGNORE_NEXT_LINE_PATTERN = /constants-ignore-next-line/;
const IGNORE_BLOCK_START_PATTERN = /constants-ignore-start/;
const IGNORE_BLOCK_END_PATTERN = /constants-ignore-end/;

export interface IgnoreBlock {
  start: number;
  end: number;
}

/**
 * True when the line above the node, or the node's own line before it, carries
 * a `constants-ignore-next-line` comment.
 */
export function hasIgnoreNextLineComment(node: Node): boolean {
  try {
    const lines = fileLinesOf(node.getSourceFile());
    const nodeStart = node.getStart();
    const previous = lines.text(lines.lineAt(nodeStart) - 1);

    if (previous !== undefined && IGNORE_NEXT_LINE_PATTERN.test(previous)) {
      return true;
    }
    if (IGNORE_NEXT_LINE_PATTERN.test(lines.textBefore(nodeStart))) {
      return true;
    }
  } catch {
    // If we can't determine, don't ignore
  }
  return false;
}

export function buildIgnoreBlocks(fileText: string): IgnoreBlock[] {
  const lines = fileText.split('\n');
  const ignoreBlocks: IgnoreBlock[] = [];
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

export function isInIgnoreBlock(line: number, ignoreBlocks: readonly IgnoreBlock[]): boolean {
  return ignoreBlocks.some((block) => line >= block.start && line <= block.end);
}
