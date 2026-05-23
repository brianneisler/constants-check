/**
 * Load and validate constants.config.json from a project root.
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import { fileExists } from '../utils/fileUtils.js';

export const CONFIG_FILE_NAME = 'constants.config.json';

export interface ConstantsConfigFile {
  // CLI-runtime options
  monorepo?: boolean;
  crossPackage?: boolean;
  definitionsOnly?: boolean;
  verbose?: boolean;
  format?: 'console' | 'json';
  paths?: string[];
  files?: string[];
  packagePriority?: string[];

  // Analysis tuning
  minDuplication?: number;
  minStringLength?: number;
  ignoreNumbers?: number[];

  // Threshold enforcement (only applied under --check)
  threshold?: number;
}

const BOOL_KEYS: (keyof ConstantsConfigFile)[] = [
  'monorepo',
  'crossPackage',
  'definitionsOnly',
  'verbose',
];
const STRING_ARRAY_KEYS: (keyof ConstantsConfigFile)[] = ['paths', 'files', 'packagePriority'];
const NUMBER_KEYS: (keyof ConstantsConfigFile)[] = [
  'minDuplication',
  'minStringLength',
  'threshold',
];

function pickKnown(raw: Record<string, unknown>): ConstantsConfigFile {
  const out: ConstantsConfigFile = {};

  for (const key of BOOL_KEYS) {
    const v = raw[key];
    if (typeof v === 'boolean') (out as Record<string, unknown>)[key] = v;
  }

  for (const key of NUMBER_KEYS) {
    const v = raw[key];
    if (typeof v === 'number' && Number.isInteger(v) && v >= 0) {
      (out as Record<string, unknown>)[key] = v;
    }
  }

  for (const key of STRING_ARRAY_KEYS) {
    const v = raw[key];
    if (Array.isArray(v) && v.every((x) => typeof x === 'string')) {
      (out as Record<string, unknown>)[key] = v as string[];
    }
  }

  if (raw.format === 'console' || raw.format === 'json') out.format = raw.format;

  if (Array.isArray(raw.ignoreNumbers) && raw.ignoreNumbers.every((x) => typeof x === 'number')) {
    out.ignoreNumbers = raw.ignoreNumbers as number[];
  }

  return out;
}

/**
 * Read `constants.config.json` from rootDir. Returns null when missing or
 * unparsable. Logs a warning to stderr on parse failure so misconfiguration
 * is visible without crashing the CLI.
 */
export async function loadConfigFile(rootDir: string): Promise<ConstantsConfigFile | null> {
  const filePath = join(rootDir, CONFIG_FILE_NAME);
  if (!(await fileExists(filePath))) return null;

  let content: string;
  try {
    content = await readFile(filePath, 'utf8');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[CONSTANTS] Failed to read ${CONFIG_FILE_NAME}: ${msg}`);
    return null;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[CONSTANTS] Failed to parse ${CONFIG_FILE_NAME}: ${msg}`);
    return null;
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    console.error(
      `[CONSTANTS] Ignoring ${CONFIG_FILE_NAME}: expected a JSON object at the top level.`
    );
    return null;
  }

  return pickKnown(raw as Record<string, unknown>);
}
