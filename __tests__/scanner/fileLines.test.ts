import { describe, it, expect } from 'vitest';
import { SyntaxKind } from 'ts-morph';
import { createFileLines, fileLinesOf, startLineOf } from '../../src/scanner/fileLines.js';
import { createSourceFile } from '../helpers/tsMorph.js';

const THREE_LINES = 'first\nsecond line\nthird';

describe('createFileLines', () => {
  it.each([
    [0, 1],
    [4, 1],
    [5, 1],
    [6, 2],
    [16, 2],
    [17, 2],
    [18, 3],
    [23, 3],
  ])('puts position %i on line %i', (pos, line) => {
    expect(createFileLines(THREE_LINES).lineAt(pos)).toBe(line);
  });

  it('agrees with splitting the text for every position', () => {
    const text = '\n\na\r\n  b\n\nlast';
    const lines = createFileLines(text);

    for (let pos = 0; pos <= text.length; pos++) {
      expect(lines.lineAt(pos)).toBe(text.substring(0, pos).split('\n').length);
      expect(lines.textBefore(pos)).toBe(text.substring(0, pos).split('\n').pop());
    }
  });

  it('returns each line without its newline, as splitting would', () => {
    const text = 'first\r\n\nlast\n';
    const lines = createFileLines(text);

    expect([1, 2, 3, 4].map((line) => lines.text(line))).toEqual(text.split('\n'));
  });

  it('has no text for a line outside the file', () => {
    const lines = createFileLines(THREE_LINES);

    expect([lines.text(0), lines.text(4)]).toEqual([undefined, undefined]);
  });

  it('treats an empty file as one empty line', () => {
    const lines = createFileLines('');

    expect([lines.lineAt(0), lines.text(1), lines.textBefore(0)]).toEqual([1, '', '']);
  });

  it('finds ignore blocks by line', () => {
    const lines = createFileLines('a\n// constants-ignore-start\nb\n// constants-ignore-end\nc');

    expect(lines.ignoreBlocks).toEqual([{ start: 2, end: 4 }]);
    expect(lines.ignoreBlocks).toBe(lines.ignoreBlocks);
  });
});

describe('fileLinesOf', () => {
  it('builds the index for a file once', () => {
    const file = createSourceFile(`const a = 'one';\n`);

    expect(fileLinesOf(file)).toBe(fileLinesOf(file));
  });
});

describe('startLineOf', () => {
  it('matches the line ts-morph reports, past leading comments', () => {
    const file = createSourceFile(
      `// header\n\n/** doc */\nconst a = 'one';\nconst b = [\n  // why\n  'two',\n];\n`
    );
    const literals = file.getDescendantsOfKind(SyntaxKind.StringLiteral);
    const statements = file.getVariableStatements();

    expect(literals.map(startLineOf)).toEqual(literals.map((n) => n.getStartLineNumber()));
    expect(statements.map(startLineOf)).toEqual(statements.map((n) => n.getStartLineNumber()));
    expect(literals.map(startLineOf)).toEqual([4, 7]);
  });
});
