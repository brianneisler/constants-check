/**
 * File system utilities
 */

import { constants } from 'fs';
import { access, readFile } from 'fs/promises';

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function readJsonFile<T = unknown>(filePath: string): Promise<T | null> {
  try {
    if (!(await fileExists(filePath))) {
      return null;
    }
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export async function safeReadFile(
  filePath: string,
  encoding: 'utf8' | 'ascii' | 'base64' | 'latin1' | 'hex' = 'utf8'
): Promise<string | null> {
  try {
    if (!(await fileExists(filePath))) {
      return null;
    }
    return await readFile(filePath, encoding);
  } catch {
    return null;
  }
}
