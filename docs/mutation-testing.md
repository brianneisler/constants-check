# Mutation Testing

We use [Stryker Mutator](https://stryker-mutator.io/) to measure how good our
tests actually are. Line coverage tells you which code *ran* during tests;
mutation testing tells you whether the tests would actually *catch a bug* if the
code's behavior changed.

Stryker makes small changes ("mutants") to the source — flipping `<` to `<=`,
`&&` to `||`, removing a statement, etc. — and re-runs the test suite for each.
A mutant that makes a test fail is **killed** (good: the tests caught it). A
mutant that leaves all tests passing **survived** (a gap: the tests can't tell
the difference).

## Running locally

```bash
npm run test:mutation              # full run
npm run test:mutation:incremental  # only re-test changed code (faster)
```

Open the HTML report at `reports/mutation/index.html` to browse surviving
mutants line by line.

## How it's wired up

- **Runner:** `@stryker-mutator/vitest-runner` reuses our existing Vitest
  config — no separate test setup.
- **TypeScript checker:** `@stryker-mutator/typescript-checker` type-checks each
  mutant first and discards ones that don't compile, so they aren't miscounted
  as survivors.
- **Config:** `stryker.config.json`. `mutate` covers the whole analysis library
  (`src/**/*.ts`). The CLI entry (`cli.ts`), the barrel export (`index.ts`), and
  type-only files are excluded — they carry no testable logic, and mutating
  arg-parsing/IO glue produces low-value survivors.
- **CI:** `.github/workflows/mutation.yml` runs on PRs that touch `src/` or
  tests, as a **separate** job (mutation runs are slow, so they stay out of the
  main Node 20/22/24 matrix). It enforces the score threshold and uploads the
  HTML report as a build artifact.

## Current score

The suite scores **~86%** mutation coverage across the library. Per-file
highlights:

| File                    | Score | Notes                                      |
| ----------------------- | ----- | ------------------------------------------ |
| computeIssueCount.ts    | 100%  |                                            |
| hashUtils.ts            | 100%  | pinned reference hashes                    |
| scanObjects.ts          | 100%  |                                            |
| fileUtils.ts            | 100%  | redundant guard removed (see below)        |
| handleIgnoreComments.ts | 97%   |                                            |
| loadConfigFile.ts       | 96%   |                                            |
| jsonReporter.ts         | 93%   |                                            |
| fuzzyMatch.ts           | 92%   |                                            |
| consoleReporter.ts      | 92%   | exact rendered-output assertions           |
| scanLiterals.ts         | 91%   |                                            |
| analyzeDefinitions.ts   | 89%   |                                            |
| scanConstants.ts        | 88%   |                                            |
| projectDiscovery.ts     | 86%   |                                            |
| detectTypeContext.ts    | 80%   |                                            |
| analyzePackage.ts       | 79%   |                                            |
| deepEqual.ts            | 79%   | residual equivalent mutants                |
| analyzeCrossPackage.ts  | 67%   |                                            |
| analyzeProject.ts       | 65%   | uncovered: error + option-default branches |

## Enforcement

`stryker.config.json` sets `thresholds.break` to **80** — the mutation job
fails if the overall score drops below it. The gap below the current ~86%
absorbs the residual equivalent mutants without making CI flaky. Ratchet
`break` upward as the score climbs.

## Survivors that turned out to be real issues

Not every surviving mutant is a test gap. An **equivalent mutant** changes the
source without changing observable behavior — and that almost always means the
underlying code is dead, redundant, or buggy. Mutation testing surfaced several
such cases, which were then fixed rather than worked around:

- **`deepEqual.ts`** conflated arrays with objects (`[1]` compared equal to
  `{0: 1}`). The redundant array branch is gone; a mixed array/object pair now
  short-circuits to `false`.
- **`fileUtils.ts`** guarded `readFile` with a separate `fileExists` check that
  was behaviorally redundant with the surrounding `try/catch` (and a TOCTOU
  race). Removing it took the file from 60% → 100% — the unkillable mutants
  *were* the dead code.
- **`fuzzyMatch.ts`** had an unreachable both-empty-string branch shadowed by the
  `s1 === s2` shortcut; removed.
- **`config.ts`** exported `ENABLE_DEEP_OBJECT_COMPARISON` and
  `DEFAULT_PACKAGE_PRIORITY` that nothing referenced, plus a `CROSS_PACKAGE_ONLY`
  constant whose only consumer was a permanently-dead branch. The flag is now
  wired to a real `--cross-package-definitions-only` CLI option.

The residual survivors in `deepEqual.ts` are genuine equivalent mutants (early
`===`/`null` short-circuits whose fall-through returns the same value) and are
documented rather than chased.

## Where to improve next

The cleanest remaining gains are in the orchestration layer — `analyzeProject.ts`
and `analyzeCrossPackage.ts` — where some error-handling and option-default
branches are still uncovered. Use the surviving-mutant report to target them.
