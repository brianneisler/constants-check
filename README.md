# constants-check

[![npm version](https://img.shields.io/npm/v/constants-check.svg)](https://www.npmjs.com/package/constants-check)
[![CI](https://github.com/brianneisler/constants-check/actions/workflows/ci.yml/badge.svg)](https://github.com/brianneisler/constants-check/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Detect duplicate constants in TypeScript/JavaScript projects and highlight where they exist—driving refactoring to consolidate them into single sources of truth.

## Why Duplicate Constants Matter

Duplicate string literals and magic numbers scattered across your codebase lead to:

- **Maintenance burden** — Changing a value requires updating multiple locations
- **Inconsistency risk** — Easy to miss one occurrence, introducing bugs
- **Poor discoverability** — No single place to find or document shared values
- **Larger bundles** — Repeated strings aren't deduplicated across modules
- **Weaker type safety** — Literals bypass the benefits of typed constants

## AI-Driven Refactoring

constants-check is designed to work seamlessly with AI coding assistants (Cursor, GitHub Copilot, etc.):

1. **Structured Output** — JSON format (`--format json`) provides machine-readable findings with file paths, line numbers, and suggested replacements
2. **Actionable Recommendations** — Each finding includes existing constants that could replace duplicates
3. **Precise Locations** — AI can apply edits directly using the exact file:line locations
4. **Consolidation Guidance** — Duplicate definition analysis suggests which package/directory should own shared constants

**Example workflow with Cursor:**

1. Run `npx constants-check --format json` and paste the output
2. Ask: "Refactor these duplicate constants into shared modules per the recommendations"
3. The AI has exact locations and suggested constants to implement the refactor correctly

## Quick Start

```bash
# Analyze the current directory
npx constants-check

# Fail the process when duplicates are found (CI mode)
npx constants-check --check

# Monorepo: analyze all packages
npx constants-check --monorepo

# Cross-package analysis only (monorepos)
npx constants-check --monorepo --cross-package

# JSON output for scripting/AI integration
npx constants-check --format json
```

## Installation

```bash
npm install --save-dev constants-check
```

Or use without installing:

```bash
npx constants-check
```

## CLI Usage

| Option                             | Description                                            |
| ---------------------------------- | ------------------------------------------------------ |
| `-c, --check`                      | Exit with code 1 when duplicates found (CI)            |
| `-j, --format <format>`            | Output: `console` (default) or `json`                  |
| `-m, --monorepo`                   | Analyze monorepo (packages/ or workspaces)             |
| `--cross-package`                  | Cross-package analysis only                            |
| `--cross-package-definitions-only` | Only report duplicate definitions that span >1 package |
| `-d, --definitions-only`           | Only check duplicate constant definitions              |
| `-v, --verbose`                    | Verbose output                                         |
| `-r, --root <path>`                | Root directory (default: cwd)                          |
| `-p, --paths <paths>`              | Comma-separated directories to scan                    |
| `-f, --files <files>`              | Comma-separated file filter for results                |
| `--package-priority <pkgs>`        | Consolidation priority (comma-separated)               |
| `--threshold <n>`                  | Max allowed issue count under `--check`                |

## Configuration File

Drop a `constants.config.json` at the root of your project (next to
`package.json`) to set defaults for every CLI option without typing them
each run. Any field is optional. Unknown keys are ignored.

```json
{
  "monorepo": true,
  "definitionsOnly": false,
  "format": "console",
  "paths": ["packages/core/src", "packages/utils/src"],
  "packagePriority": ["@scope/core", "@scope/utils"],
  "ignoreNumbers": [0, 1, 2, -1, 10, 100],
  "minDuplication": 2,
  "minStringLength": 3,
  "threshold": 50
}
```

**Precedence:** CLI flag > `constants.config.json` > built-in default. So a
config file can set the project baseline while individual runs override it
with one-off CLI flags.

## Threshold Mode

For projects that can't reach zero duplicates in a single pass, set a
`threshold` (in `constants.config.json` or via `--threshold <n>`) and run
with `--check`. The total issue count — every duplicate-literal occurrence
plus every duplicate constant definition — is compared to the threshold:

- **Above threshold** → exit code `1` with
  `Issue count <total> exceeds threshold <n>. Fix issues to get the count to <n> or below.`
- **At threshold** → exit code `0`, silent.
- **Below threshold** → exit code `0` with
  `Issue count <total> is below threshold <n>. Consider lowering the threshold to <total> to lock in progress.`

This turns `constants-check` into a ratchet: every PR has to keep the
count at or under the configured limit, and the friendly nudge prompts you
to tighten the threshold whenever you make real progress.

Without `--check`, the threshold is reported but never causes a non-zero
exit. JSON output (`--format json`) always includes `summary.totalIssues`,
and when a threshold is configured it also includes `summary.threshold` and
`summary.thresholdStatus` (`under` | `at` | `over`).

## Programmatic API

```typescript
import { runConstantsAnalyzer } from 'constants-check';

const result = await runConstantsAnalyzer({
  root: process.cwd(),
  monorepo: true,
  config: {
    minDuplication: 2,
    minStringLength: 3,
    ignoreNumbers: [0, 1, 2, -1, 10, 100],
  },
});

console.log(result.analysisFailure); // true if duplicates found
console.log(result.results); // per-package results
```

## Ignore Comments

Suppress specific findings:

```typescript
// constants-ignore-next-line
const value = 'intentionally duplicate';

/* constants-ignore-start */
const A = 'a';
const B = 'b';
/* constants-ignore-end */
```

## CI Integration

### GitHub Actions

```yaml
- name: Check for duplicate constants
  run: npx constants-check --check
```

### Pre-commit / Pre-push

Add to your quality gates:

```bash
npx constants-check --check
```

## Requirements

- Node.js >= 20
- TypeScript/JavaScript project with `tsconfig.json` (for project resolution)

## License

MIT
