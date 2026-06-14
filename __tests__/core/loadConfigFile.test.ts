import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadConfigFile, CONFIG_FILE_NAME } from '../../src/core/loadConfigFile.js';

describe('loadConfigFile', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'constants-check-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns null when the file does not exist', async () => {
    expect(await loadConfigFile(dir)).toBeNull();
  });

  it('parses a valid config with every supported field', async () => {
    const cfg = {
      monorepo: true,
      crossPackage: false,
      crossPackageDefinitionsOnly: true,
      definitionsOnly: true,
      verbose: false,
      format: 'json',
      paths: ['src', 'lib'],
      files: ['a.ts', 'b.ts'],
      packagePriority: ['core', 'utils'],
      minDuplication: 3,
      minStringLength: 5,
      ignoreNumbers: [0, 1, 2],
      threshold: 50,
    };
    await writeFile(join(dir, CONFIG_FILE_NAME), JSON.stringify(cfg), 'utf8');

    const loaded = await loadConfigFile(dir);
    expect(loaded).toEqual(cfg);
  });

  it('drops root (not a supported config field)', async () => {
    await writeFile(
      join(dir, CONFIG_FILE_NAME),
      JSON.stringify({ root: '/some/path', threshold: 10 }),
      'utf8'
    );

    const loaded = await loadConfigFile(dir);
    expect(loaded).toEqual({ threshold: 10 });
    expect((loaded as Record<string, unknown>).root).toBeUndefined();
  });

  it('rejects non-integer or negative threshold values', async () => {
    await writeFile(
      join(dir, CONFIG_FILE_NAME),
      JSON.stringify({ threshold: -5, minDuplication: 2.5 }),
      'utf8'
    );

    expect(await loadConfigFile(dir)).toEqual({});
  });

  it('drops unknown keys silently', async () => {
    await writeFile(
      join(dir, CONFIG_FILE_NAME),
      JSON.stringify({ threshold: 10, somethingElse: 'nope', another: 123 }),
      'utf8'
    );

    const loaded = await loadConfigFile(dir);
    expect(loaded).toEqual({ threshold: 10 });
  });

  it('drops keys with the wrong type', async () => {
    await writeFile(
      join(dir, CONFIG_FILE_NAME),
      JSON.stringify({
        threshold: 'not-a-number',
        monorepo: 'yes',
        ignoreNumbers: [1, 'two', 3],
        format: 'xml',
      }),
      'utf8'
    );

    expect(await loadConfigFile(dir)).toEqual({});
  });

  it('returns null and warns on malformed JSON', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await writeFile(join(dir, CONFIG_FILE_NAME), '{ this is not json', 'utf8');

    expect(await loadConfigFile(dir)).toBeNull();
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0]?.[0]).toContain('Failed to parse');

    spy.mockRestore();
  });

  it('returns null and warns when top-level JSON is not an object', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await writeFile(join(dir, CONFIG_FILE_NAME), '[1, 2, 3]', 'utf8');

    expect(await loadConfigFile(dir)).toBeNull();
    expect(spy).toHaveBeenCalledOnce();

    spy.mockRestore();
  });

  it('accepts zero as a valid integer for numeric fields (>= 0 boundary)', async () => {
    await writeFile(
      join(dir, CONFIG_FILE_NAME),
      JSON.stringify({ threshold: 0, minDuplication: 0, minStringLength: 0 }),
      'utf8'
    );
    expect(await loadConfigFile(dir)).toEqual({
      threshold: 0,
      minDuplication: 0,
      minStringLength: 0,
    });
  });

  it("accepts format 'console'", async () => {
    await writeFile(
      join(dir, CONFIG_FILE_NAME),
      JSON.stringify({ format: 'console' }),
      'utf8'
    );
    expect(await loadConfigFile(dir)).toEqual({ format: 'console' });
  });

  it('drops string-array fields that contain a non-string element', async () => {
    await writeFile(
      join(dir, CONFIG_FILE_NAME),
      JSON.stringify({ paths: ['ok', 123], files: ['fine'] }),
      'utf8'
    );
    expect(await loadConfigFile(dir)).toEqual({ files: ['fine'] });
  });

  it('returns null and warns when the file cannot be read', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Make the config path a directory so readFile fails with EISDIR.
    await mkdir(join(dir, CONFIG_FILE_NAME));

    expect(await loadConfigFile(dir)).toBeNull();
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0]?.[0]).toContain('Failed to read');

    spy.mockRestore();
  });

  it('returns null and warns when top-level JSON is null', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await writeFile(join(dir, CONFIG_FILE_NAME), 'null', 'utf8');

    expect(await loadConfigFile(dir)).toBeNull();
    expect(spy).toHaveBeenCalledOnce();

    spy.mockRestore();
  });

  it('returns null when top-level JSON is a number', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await writeFile(join(dir, CONFIG_FILE_NAME), '42', 'utf8');

    expect(await loadConfigFile(dir)).toBeNull();

    spy.mockRestore();
  });

  it('reads from the given rootDir, not cwd', async () => {
    const other = await mkdtemp(join(tmpdir(), 'constants-check-other-'));
    try {
      await writeFile(join(other, CONFIG_FILE_NAME), JSON.stringify({ threshold: 99 }), 'utf8');
      expect(await loadConfigFile(dir)).toBeNull();
      expect(await loadConfigFile(other)).toEqual({ threshold: 99 });
    } finally {
      await rm(other, { recursive: true, force: true });
    }
  });
});
