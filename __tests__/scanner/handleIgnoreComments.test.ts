import { describe, it, expect } from 'vitest';
import { SyntaxKind } from 'ts-morph';
import {
  hasIgnoreNextLineComment,
  buildIgnoreBlocks,
  isInIgnoreBlock,
} from '../../src/scanner/handleIgnoreComments.js';
import { createSourceFile } from '../helpers/tsMorph.js';

describe('buildIgnoreBlocks', () => {
  it('returns an empty list when there are no markers', () => {
    expect(buildIgnoreBlocks('const A = 1;\nconst B = 2;')).toEqual([]);
  });

  it('captures a single start/end block with 1-based line numbers', () => {
    const text = ['line1', '// constants-ignore-start', 'line3', '// constants-ignore-end'].join(
      '\n'
    );
    expect(buildIgnoreBlocks(text)).toEqual([{ start: 2, end: 4 }]);
  });

  it('captures multiple blocks', () => {
    const text = [
      '// constants-ignore-start', // 1
      '// constants-ignore-end', // 2
      'middle', // 3
      '// constants-ignore-start', // 4
      '// constants-ignore-end', // 5
    ].join('\n');
    expect(buildIgnoreBlocks(text)).toEqual([
      { start: 1, end: 2 },
      { start: 4, end: 5 },
    ]);
  });

  it('ignores an end marker with no preceding start', () => {
    expect(buildIgnoreBlocks('// constants-ignore-end')).toEqual([]);
  });

  it('ignores an unterminated start marker', () => {
    expect(buildIgnoreBlocks('// constants-ignore-start\ncode')).toEqual([]);
  });
});

describe('isInIgnoreBlock', () => {
  const blocks = [{ start: 3, end: 5 }];

  it('is true on the start boundary', () => {
    expect(isInIgnoreBlock(3, blocks)).toBe(true);
  });

  it('is true on the end boundary', () => {
    expect(isInIgnoreBlock(5, blocks)).toBe(true);
  });

  it('is true inside the block', () => {
    expect(isInIgnoreBlock(4, blocks)).toBe(true);
  });

  it('is false just before the block', () => {
    expect(isInIgnoreBlock(2, blocks)).toBe(false);
  });

  it('is false just after the block', () => {
    expect(isInIgnoreBlock(6, blocks)).toBe(false);
  });

  it('is false with no blocks', () => {
    expect(isInIgnoreBlock(4, [])).toBe(false);
  });
});

describe('hasIgnoreNextLineComment', () => {
  function firstVariableStatement(code: string) {
    const file = createSourceFile(code);
    const node = file.getFirstDescendantByKind(SyntaxKind.VariableStatement);
    if (!node) throw new Error('no variable statement');
    return node;
  }

  it('detects an ignore comment on the line directly above', () => {
    const node = firstVariableStatement('// constants-ignore-next-line\nconst A = 1;');
    expect(hasIgnoreNextLineComment(node)).toBe(true);
  });

  it('returns false when there is no ignore comment', () => {
    const node = firstVariableStatement('// just a comment\nconst A = 1;');
    expect(hasIgnoreNextLineComment(node)).toBe(false);
  });

  it('returns false when the ignore comment is two lines above', () => {
    const node = firstVariableStatement('// constants-ignore-next-line\n\nconst A = 1;');
    expect(hasIgnoreNextLineComment(node)).toBe(false);
  });

  it('detects an inline ignore comment on the same line as the node', () => {
    const node = firstVariableStatement('/* constants-ignore-next-line */ const A = 1;');
    expect(hasIgnoreNextLineComment(node)).toBe(true);
  });
});
