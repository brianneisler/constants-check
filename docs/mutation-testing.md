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

The suite scores **~85%** mutation coverage across the library. Per-file
highlights:

| File                    | Score | Notes                                      |
| ----------------------- | ----- | ------------------------------------------ |
| computeIssueCount.ts    | 100%  |                                            |
| config.ts               | 100%  |                                            |
| hashUtils.ts            | 100%  | pinned reference hashes                    |
| scanObjects.ts          | 100%  |                                            |
| handleIgnoreComments.ts | 97%   |                                            |
| loadConfigFile.ts       | 96%   |                                            |
| jsonReporter.ts         | 93%   |                                            |
| consoleReporter.ts      | 92%   | exact rendered-output assertions           |
| scanLiterals.ts         | 91%   |                                            |
| fuzzyMatch.ts           | 90%   | remaining survivors are equivalent mutants |
| scanConstants.ts        | 88%   |                                            |
| projectDiscovery.ts     | 86%   |                                            |
| analyzeDefinitions.ts   | 81%   |                                            |
| detectTypeContext.ts    | 80%   |                                            |
| analyzePackage.ts       | 77%   |                                            |
| deepEqual.ts            | 77%   | remaining survivors are equivalent mutants |
| analyzeCrossPackage.ts  | 69%   |                                            |
| analyzeProject.ts       | 64%   | uncovered: error + option-default branches |
| fileUtils.ts            | 60%   | remaining survivors are equivalent mutants |

## Enforcement

`stryker.config.json` sets `thresholds.break` to **80** — the mutation job
fails if the overall score drops below it. The 5-point gap below the current
~85% absorbs the known equivalent mutants without making CI flaky. Ratchet
`break` upward as the score climbs.

## A note on equivalent mutants

Not every surviving mutant is a real test gap. An **equivalent mutant** changes
the source without changing observable behavior, so no test can kill it. The
lower-scoring files here are dominated by these:

- **`deepEqual.ts`** — early `===`, `null`, and `undefined` short-circuits mean
  several downstream type/key checks can be mutated without changing any result
  (the fall-through path returns the same value).
- **`fuzzyMatch.ts`** — the `s1 === s2` shortcut shadows the empty-string
  branches, which are therefore unreachable for distinct inputs.
- **`fileUtils.ts`** — the `fileExists` guard is redundant with the surrounding
  `try/catch`: removing it just lets `readFile` throw and be caught, returning
  the same `null`.

These are documented rather than chased, so reviewers don't waste effort trying
to "fix" untestable lines.

## Where to improve next

The cleanest remaining gains are in the orchestration layer — `analyzeProject.ts`
and `analyzeCrossPackage.ts` — where some error-handling and option-default
branches are still uncovered. Use the surviving-mutant report to target them.
