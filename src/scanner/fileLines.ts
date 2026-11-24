/**
 * Line lookups for one source file, computed once.
 *
 * Every literal needs its line number, the text of that line and the text of
 * the line above it. Asking ts-morph for a line number counts newlines from the
 * top of the file, and splitting the file's text per literal copies the whole
 * file each time, so a file with many literals paid for its full length once
 * per literal, several times over. The index is built on first use and is
 * dropped with the file.
 *
 * Lines are separated by `\n` only, the same rule `String.split('\n')` and
 * ts-morph's `getStartLineNumber` apply, so a `\r\n` file keeps its `\r` at the
 * end of each line's text.
 */

import type { Node, SourceFile } from 'ts-morph';
import { buildIgnoreBlocks, type IgnoreBlock } from './handleIgnoreComments.js';

const NEWLINE = '\n';

export interface FileLines {
  readonly ignoreBlocks: readonly IgnoreBlock[];
  /** The 1-based line holding the character at `pos` */
  lineAt(pos: number): number;
  /** The text of a 1-based line without its newline, or `undefined` past the end */
  text(line: number): string | undefined;
  /** The text of the line holding `pos`, up to but not including `pos` */
  textBefore(pos: number): string;
}

function lineStartsOf(fullText: string): number[] {
  const starts = [0];
  let at = fullText.indexOf(NEWLINE);
  while (at !== -1) {
    starts.push(at + 1);
    at = fullText.indexOf(NEWLINE, at + 1);
  }
  return starts;
}

export function createFileLines(fullText: string): FileLines {
  const starts = lineStartsOf(fullText);
  let ignoreBlocks: IgnoreBlock[] | undefined;

  /** Index of the last line start at or before `pos` */
  function indexAt(pos: number): number {
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (starts[middle] <= pos) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }
    return low;
  }

  function text(line: number): string | undefined {
    const index = line - 1;
    if (index < 0 || index >= starts.length) return undefined;
    const end = index + 1 < starts.length ? starts[index + 1] - 1 : fullText.length;
    return fullText.slice(starts[index], end);
  }

  return {
    get ignoreBlocks() {
      ignoreBlocks ??= buildIgnoreBlocks(fullText);
      return ignoreBlocks;
    },
    lineAt: (pos) => indexAt(pos) + 1,
    text,
    textBefore: (pos) => fullText.slice(starts[indexAt(pos)], pos),
  };
}

const cache = new WeakMap<SourceFile, FileLines>();

export function fileLinesOf(file: SourceFile): FileLines {
  let lines = cache.get(file);
  if (!lines) {
    lines = createFileLines(file.getFullText());
    cache.set(file, lines);
  }
  return lines;
}

/** The 1-based line a node starts on, after its leading comments */
export function startLineOf(node: Node): number {
  return fileLinesOf(node.getSourceFile()).lineAt(node.getStart());
}
