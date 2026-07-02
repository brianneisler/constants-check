import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileExists, readJsonFile, safeReadFile } from '../../src/utils/fileUtils.js';

describe('fileUtils', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'constants-check-fu-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  describe('fileExists', () => {
    it('returns true for an existing file', async () => {
      const file = join(dir, 'present.txt');
      await writeFile(file, 'hi', 'utf8');
      expect(await fileExists(file)).toBe(true);
    });

    it('returns false for a missing file', async () => {
      expect(await fileExists(join(dir, 'missing.txt'))).toBe(false);
    });
  });

  describe('readJsonFile', () => {
    it('parses valid JSON', async () => {
      const file = join(dir, 'data.json');
      await writeFile(file, JSON.stringify({ a: 1, b: [2, 3] }), 'utf8');
      expect(await readJsonFile(file)).toEqual({ a: 1, b: [2, 3] });
    });

    it('returns null for a missing file', async () => {
      expect(await readJsonFile(join(dir, 'missing.json'))).toBeNull();
    });

    it('returns null for invalid JSON', async () => {
      const file = join(dir, 'bad.json');
      await writeFile(file, '{ not valid', 'utf8');
      expect(await readJsonFile(file)).toBeNull();
    });
  });

  describe('safeReadFile', () => {
    it('returns file contents for an existing file', async () => {
      const file = join(dir, 'text.txt');
      await writeFile(file, 'hello world', 'utf8');
      expect(await safeReadFile(file)).toBe('hello world');
    });

    it('returns null for a missing file', async () => {
      expect(await safeReadFile(join(dir, 'missing.txt'))).toBeNull();
    });

    it('honors a non-default encoding', async () => {
      const file = join(dir, 'hex.txt');
      await writeFile(file, 'AB', 'utf8');
      expect(await safeReadFile(file, 'hex')).toBe('4142');
    });
  });
});
