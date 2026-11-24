import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { DEFAULT_CONFIG } from '../../src/core/config.js';
import {
  findSourceFilePaths,
  scanSourceFiles,
  type ScanSourceFilesOptions,
} from '../../src/core/scanSourceFiles.js';

const DEFINED_LATER = 'defined-in-the-second-file';

/** A project over an in-memory file system holding `files`; nothing is parsed yet. */
function projectOf(files: Record<string, string>): { paths: string[]; project: Project } {
  const project = new Project({ useInMemoryFileSystem: true });
  const paths = Object.entries(files).map(([name, code]) => {
    project.getFileSystem().writeFileSync(`/repo/${name}`, code);
    return `/repo/${name}`;
  });
  return { paths, project };
}

function optionsWith(overrides: Partial<ScanSourceFilesOptions> = {}): ScanSourceFilesOptions {
  return {
    config: DEFAULT_CONFIG,
    definitionsOnly: false,
    packageNameFor: () => 'pkg',
    projectRoot: '/repo',
    ...overrides,
  };
}

describe('scanSourceFiles', () => {
  it('holds no file once the scan is over', () => {
    const { paths, project } = projectOf({
      'a.ts': `use('a-value-here');\n`,
      'b.ts': `use('b-value-here');\n`,
    });

    scanSourceFiles(project, paths, optionsWith());

    expect(project.getSourceFiles()).toHaveLength(0);
  });

  it('opens a file only when its turn comes', () => {
    const { paths, project } = projectOf({
      'a.ts': `use('a-value-here');\n`,
      'b.ts': `use('b-value-here');\n`,
    });
    const openWhileScanning: number[] = [];

    scanSourceFiles(
      project,
      paths,
      optionsWith({
        packageNameFor: () => {
          openWhileScanning.push(project.getSourceFiles().length);
          return 'pkg';
        },
      })
    );

    expect(openWhileScanning).toEqual([1, 1]);
  });

  it('releases a file whose scan throws', () => {
    const { paths, project } = projectOf({ 'a.ts': `use('a-value-here');\n` });
    const failing = optionsWith({
      packageNameFor: () => {
        throw new Error('no package');
      },
    });

    expect(() => scanSourceFiles(project, paths, failing)).toThrow('no package');
    expect(project.getSourceFiles()).toHaveLength(0);
  });

  it('counts a literal used before the file that defines it is reached', () => {
    const { paths, project } = projectOf({
      'a.ts': `use('${DEFINED_LATER}');\n`,
      'b.ts': `export const LATER = '${DEFINED_LATER}';\nuse('${DEFINED_LATER}');\n`,
    });

    const scan = scanSourceFiles(project, paths, optionsWith());

    expect(scan.stringCounts.get(DEFINED_LATER)).toMatchObject({ count: 2 });
    expect(scan.stringCounts.get(DEFINED_LATER)?.locations.map((l) => l.file)).toEqual([
      'a.ts',
      'b.ts',
    ]);
    expect(scan.stringConstants.get(DEFINED_LATER)?.map((d) => d.name)).toEqual(['LATER']);
  });

  it('does not count the line a constant is defined on', () => {
    const { paths, project } = projectOf({
      'a.ts': `export const TIMEOUT_MS = 54321;\nwait(54321);\n`,
    });

    const scan = scanSourceFiles(project, paths, optionsWith());

    const [occurrence] = [...scan.numberCounts.values()];
    expect(occurrence.locations.map((l) => l.line)).toEqual([2]);
  });

  it('attributes a definition to the package its path maps to', () => {
    const { paths, project } = projectOf({
      'packages/ui/src/a.ts': `export const LABEL = 'label-value';\n`,
    });

    const scan = scanSourceFiles(
      project,
      paths,
      optionsWith({ packageNameFor: (relativePath) => relativePath.split('/')[1] })
    );

    expect(scan.stringConstants.get('label-value')?.[0]).toMatchObject({
      file: 'packages/ui/src/a.ts',
      packageName: 'ui',
    });
  });

  it('collects definitions but no occurrences under definitionsOnly', () => {
    const { paths, project } = projectOf({
      'a.ts': `export const LABEL = 'label-value';\nuse('other-value');\n`,
    });

    const scan = scanSourceFiles(project, paths, optionsWith({ definitionsOnly: true }));

    expect(scan.stringConstants.has('label-value')).toBe(true);
    expect(scan.stringCounts.size).toBe(0);
    expect(scan.numberCounts.size).toBe(0);
  });
});

describe('findSourceFilePaths', () => {
  it('lists each matching file once, leaving out the ones to skip, and holds none of them', () => {
    const { project } = projectOf({
      'src/a.ts': `use('a-value-here');\n`,
      'src/b.tsx': `use('b-value-here');\n`,
      'src/types.d.ts': `declare const x: 'declared-value';\n`,
      'notes.md': `not source\n`,
    });

    const found = findSourceFilePaths(
      project,
      ['/repo/src/**/*.ts', '/repo/src/**/*.tsx', '/repo/**/*.ts'],
      (filePath) => filePath.endsWith('.d.ts')
    );

    expect([...found].sort()).toEqual(['/repo/src/a.ts', '/repo/src/b.tsx']);
    expect(project.getSourceFiles()).toHaveLength(0);
  });

  it('orders files as a project holding all of them would', () => {
    const files = {
      'src/deep/nested/z.ts': '',
      'src/b.ts': '',
      'src/deep/a.ts': '',
      'src/B.ts': '',
      'src/a.tsx': '',
      'other/c.ts': '',
    };
    const { paths, project } = projectOf(files);
    const whole = new Project({ useInMemoryFileSystem: true });
    for (const filePath of paths) whole.createSourceFile(filePath, '');

    const found = findSourceFilePaths(project, ['/repo/**/*.ts', '/repo/**/*.tsx'], () => false);

    expect(found).toEqual(whole.getSourceFiles().map((file) => file.getFilePath()));
    expect(found).toHaveLength(paths.length);
  });

  it('leaves the real file to be read when its turn comes', () => {
    const { project } = projectOf({ 'src/a.ts': `use('a-value-here');\nuse('a-value-here');\n` });

    const found = findSourceFilePaths(project, ['/repo/**/*.ts'], () => false);
    const scan = scanSourceFiles(project, found, optionsWith());

    expect(scan.stringCounts.get('a-value-here')).toMatchObject({ count: 2 });
  });
});
