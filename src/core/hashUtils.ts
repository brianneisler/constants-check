/**
 * Hashing utilities for constant structure comparison
 */

import * as crypto from 'crypto';

function normalizeForHashing(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);

  if (Array.isArray(value)) {
    const items = value.map((item) => normalizeForHashing(item)).join(',');
    return `[${items}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.keys(value as object)
      .sort()
      .map((key) => {
        const val = (value as Record<string, unknown>)[key];
        return `"${key}":${normalizeForHashing(val)}`;
      })
      .join(',');
    return `{${entries}}`;
  }

  return `[${typeof value}]`;
}

export function hashObjectStructure(value: unknown): string {
  const normalized = normalizeForHashing(value);
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}
