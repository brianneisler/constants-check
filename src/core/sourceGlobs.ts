/**
 * The globs ts-morph collects source files from.
 *
 * Exclusions are applied here, at collection time, rather than by filtering
 * `project.getSourceFiles()` afterwards: every file ts-morph adds is parsed and
 * held in memory for the whole run, so a filter applied after collection saves
 * nothing. In a monorepo whose packages hold build output — a CDK `cdk.out`
 * with hundreds of staged asset copies, each carrying its own `src/` — that is
 * the difference between a run that fits in memory and one that does not.
 */

import * as path from 'path';

/**
 * Always excluded. Scanning already discards these files (`shouldSkipFile`),
 * so excluding them at collection time changes no finding, only memory.
 */
export const BUILT_IN_IGNORE: readonly string[] = ['**/node_modules/**', '**/*.d.ts'];

function toPosix(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

/** A pattern relative to the analysis root, or an absolute one kept as written. */
function resolvePattern(root: string, pattern: string): string {
  const normalized = toPosix(pattern);
  if (path.isAbsolute(pattern) || path.posix.isAbsolute(normalized)) {
    return normalized;
  }
  return path.posix.join(toPosix(root), normalized);
}

/**
 * `includes` followed by a negated glob for every built-in and user `ignore`
 * pattern. User patterns are resolved against `root` (the analysis root, where
 * `constants.config.json` lives), so `**\/cdk.out/**` ignores every `cdk.out`
 * directory under it.
 */
export function buildSourceGlobs(
  includes: readonly string[],
  root: string,
  ignore: readonly string[] = []
): string[] {
  const excludes = [...BUILT_IN_IGNORE, ...ignore].map(
    (pattern) => `!${resolvePattern(root, pattern)}`
  );
  return [...includes.map(toPosix), ...excludes];
}
