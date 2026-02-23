# Commit and Push to Main

## Overview

This command commits staged changes and pushes them to the main branch with intelligent error handling and automatic retry logic for pre-commit hook failures.

## Parameters

- `--no-verify-commit` - Skip pre-commit hooks when committing
- `--no-verify-push` - Skip pre-push hooks when pushing

## Instructions

You are helping the user commit and push changes to the main branch. Follow these steps:

### Step 1: Check for Staged Changes

1. Check if there are any staged changes:

```bash
git diff --cached --name-only
```

2. If no files are staged, inform the user:

```text
❌ No files are staged for commit.

Use `git add <files>` to stage files, or stage all changes with:
git add .
```

Stop here if no files are staged.

### Step 2: Review Staged Changes

1. Get the list of staged files:

```bash
git diff --cached --name-status
```

2. Review the actual changes:

```bash
git diff --cached
```

3. Analyze the changes and categorize them by:
   - **Type of changes**: Features, fixes, refactoring, tests, documentation, configuration
   - **Affected areas**: Packages, services, components, utilities
   - **Scope**: UI changes, backend changes, infrastructure, tooling

### Step 3: Prepare Commit Message

Create a clear, concise commit message following these guidelines:

**Format:**

```text
<type>(<scope>): <short summary>

<detailed description>

<breaking changes if any>
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `chore`: Maintenance tasks, dependencies
- `perf`: Performance improvements
- `ci`: CI/CD changes
- `build`: Build system changes

**Guidelines:**

- Keep the summary line under 72 characters
- Focus on **what** and **why**, not **how**
- Group related changes into high-level concepts
- Use present tense ("add feature" not "added feature")
- Be specific but concise

**Example:**

```text
feat(agent): add memory summarization and context management

- Implement automatic message history summarization at 32K tokens
- Add dynamic context loading with file watching
- Integrate RAG system for enhanced context retrieval
- Update system prompt with self-improvement mission

These changes enable the agent to maintain conversation context
efficiently while staying under token limits.
```

### Step 4: Attempt to Commit

**If --no-verify-commit parameter is provided:**

```bash
git commit --no-verify -m "<commit message>"
```

**Otherwise:**

```bash
git commit -m "<commit message>"
```

### Step 5: Handle Pre-Commit Hook Failures

If the commit fails due to pre-commit hook errors:

1. **Read the error output** to understand what failed:
   - Linting errors
   - Formatting issues
   - Type errors
   - Test failures

2. **Fix the issues:**
   - For formatting: Run `npm run format` or fix manually
   - For linting: Run `npm run lint` or fix manually
   - For type errors: Fix TypeScript issues
   - For test failures: Fix failing tests

3. **Stage the fixes:**

```bash
git add <fixed-files>
```

4. **Review the new changes** to ensure fixes are correct:

```bash
git diff --cached
```

5. **Update the commit message if needed** to reflect any additional fixes:
   - If fixes are minor (formatting, linting), keep the original message
   - If fixes required code changes, mention them in the message

6. **Retry the commit:**

```bash
git commit -m "<updated commit message>"
```

7. **Repeat Steps 5.1-5.6** until the commit succeeds.

**Important:**

- Never use `--no-verify` unless explicitly provided as a parameter
- Always fix issues rather than bypassing hooks
- If you encounter repeated failures (>3 attempts), explain the issue to the user and ask for guidance

### Step 6: Confirm Commit Success

Once the commit succeeds, confirm to the user:

```text
✅ Commit successful!

Commit: <commit-hash>
Message: <commit-message-summary>
Files changed: <number>
```

### Step 7: Push to Main

Check the current branch:

```bash
git branch --show-current
```

If not on `main`, inform the user:

```text
⚠️  You are on branch '<current-branch>', not 'main'.

Do you want to:
1. Push to '<current-branch>'?
2. Switch to 'main' and push?
3. Cancel?
```

Wait for user's response before proceeding.

**If on main (or user confirmed):**

**If --no-verify-push parameter is provided:**

```bash
git push --no-verify origin main
```

**Otherwise:**

```bash
git push origin main
```

### Step 8: Handle Pre-Push Hook Failures

If the push fails due to pre-push hook errors (and `--no-verify-push` was NOT used):

1. Read the error output to understand what failed

2. Inform the user:

```text
✅ Commit was successful!
❌ Push failed due to pre-push hook errors:

<error details>

The commit is saved locally but was not pushed to remote.

Options:
1. Fix the issues and try pushing again
2. Use --no-verify-push to bypass pre-push hooks
3. Push manually later

What would you like to do?
```

Stop here and wait for user's decision.

**If push hook errors occur WITH --no-verify-push:**

The push should succeed since hooks are bypassed. Confirm:

```text
✅ Commit successful!
✅ Push successful (pre-push hooks were skipped)!

Remote: origin/main
Commit: <commit-hash>
```

### Step 9: Confirm Push Success

Once the push succeeds, confirm to the user:

```text
✅ Commit successful!
✅ Push successful!

Remote: origin/main
Commit: <commit-hash>
Branch: main
```

## Error Recovery Strategies

### For Linting Errors:

```bash
npm run lint
git add <fixed-files>
```

### For Formatting Errors:

```bash
npm run format
git add <formatted-files>
```

### For Type Errors:

- Fix TypeScript compilation errors manually
- Run `npm run typecheck` to verify
- Stage the fixes

### For Test Failures:

- Fix failing tests
- Run `npm run test` to verify
- Stage the fixes

### For Build Errors:

```bash
npm run build
# Fix any build errors
git add <fixed-files>
```

### For Pre-Push Hook Failures:

- These typically indicate:
  - Failing tests that passed locally but fail in CI-like environment
  - Linting issues in files not caught by pre-commit
  - Type errors not caught earlier
- Run the full dev workflow:

```bash
npm run dev-workflow
```

- If all passes, the push hook should pass too

## Important Notes

- **Always review changes** before committing - understand what's being committed
- **Write meaningful commit messages** - they help with debugging and understanding history
- **Never bypass hooks** unless explicitly requested by the user via parameters
- **Fix issues properly** - don't just add `--no-verify` to make it work
- **Retry intelligently** - if the same error occurs 3+ times, ask for help
- **Preserve commit history** - if you amend or rewrite commits, explain why
- **Check branch** - always verify you're pushing to the correct branch

## Usage Examples

**Basic usage:**

```bash
/commit-and-push
```

**Skip commit hooks:**

```bash
/commit-and-push --no-verify-commit
```

**Skip push hooks:**

```bash
/commit-and-push --no-verify-push
```

**Skip both:**

```bash
/commit-and-push --no-verify-commit --no-verify-push
```

## Workflow Summary

```text
1. Check staged files
2. Review changes
3. Prepare commit message
4. Commit
   ↓ (if fails)
5. Fix issues
6. Stage fixes
7. Update message
8. Retry commit (loop until success)
9. Confirm commit
10. Push to main
    ↓ (if fails & no --no-verify-push)
11. Notify user (commit succeeded, push failed)
12. Wait for user decision
```
