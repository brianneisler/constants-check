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
npm run test:mutation              # full pilot run
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
- **Config:** `stryker.config.json`.
- **CI:** `.github/workflows/mutation.yml` runs on PRs that touch `src/` or
  tests, as a **separate, non-blocking** job (mutation runs are slow, so they
  stay out of the main Node 20/22/24 CI matrix). It uploads the HTML report as
  a build artifact.

## This is a pilot — scope is intentionally small

`mutate` in `stryker.config.json` is **deliberately limited** to the modules
that already have tests:

- `src/comparison/deepEqual.ts`
- `src/comparison/fuzzyMatch.ts`
- `src/scanner/scanConstants.ts`
- `src/core/computeIssueCount.ts`
- `src/core/loadConfigFile.ts`

Pointing Stryker at all 22 source files while only ~5 have tests would produce a
flood of survivors and a long runtime that tells us nothing new. Scoping to
tested code gives a meaningful baseline and shows where *existing* tests are
weak.

### Baseline (first pilot run)

| File                  | Mutation score |
| --------------------- | -------------- |
| computeIssueCount.ts  | 100%           |
| fuzzyMatch.ts         | 83%            |
| loadConfigFile.ts     | 76%            |
| deepEqual.ts          | 57%            |
| scanConstants.ts      | 10%            |
| **All pilot files**   | **58%**        |

Takeaways: `deepEqual`'s tests check results but miss several branches, and
`scanConstants` has a test file that exercises only a small part of the module.
These are the first places to strengthen tests.

## Rollout plan

1. **Report-only.** `thresholds.break` is `0` — CI reports the score and
   publishes the report but never fails. (Stryker v9 requires `break >= 0`, so
   `0` is the "never break" value.)
2. **Strengthen the weak pilot files** (`deepEqual`, `scanConstants`) using the
   surviving-mutant report to guide which assertions/cases to add.
3. **Ratchet the threshold.** Once a file is solid, raise `thresholds.break`
   toward the score so regressions fail the build.
4. **Expand scope.** Add modules to `mutate` as they gain tests — let the
   mutation report drive *where* to write tests next (scanner, reporter, and the
   core analysis pipeline are currently untested).

## Notes

- `src/cli.ts` and the `commander` argument wiring are intentionally excluded —
  mutating IO/glue code yields low-value survivors.
- First full run is on the order of a minute; `incremental: true` keeps repeat
  runs fast.
