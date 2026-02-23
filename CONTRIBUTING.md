# Contributing to constants-check

Thank you for your interest in contributing to constants-check! Every contribution—whether it's
code, documentation, bug reports, or ideas—helps improve the tool for the community.

## Quick Start for Contributors

### Prerequisites

- **Node.js 20+** (see `.nvmrc`)
- **Git**

### Initial Setup

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/your-username/constants-check.git
   cd constants-check
   ```

2. **Install dependencies**

   ```bash
   npm ci
   ```

3. **Verify your setup**

   ```bash
   npm run dev-workflow
   ```

   This should complete with a successful status. If it fails, check the error messages and fix
   any issues before proceeding.

## Development Workflow

### The Golden Rule: Always Run the Development Workflow

After making ANY code changes, always run:

```bash
npm run dev-workflow
```

This comprehensive script:

- Automatically fixes formatting issues (Prettier)
- Automatically fixes linting issues (ESLint)
- Verifies the build (tsup)
- Runs type checking (TypeScript)
- Runs the test suite (Vitest)

**Never submit a pull request without ensuring this command passes.**

### Quick Reference Commands

```bash
npm run dev-workflow       # Auto-fix issues and run all checks
npm run dev-workflow:check # Check without auto-fixing
npm run dev-workflow:quick # Skip tests (development only)

npm run build              # Build with tsup
npm run test               # Run tests
npm run test:coverage      # Tests with coverage
npm run lint               # Fix linting issues
npm run lint:check         # Lint check only
npm run format             # Format with Prettier
npm run format:check       # Check formatting
npm run typecheck          # TypeScript type check
```

## Project Structure

```text
constants-check/
├── src/
│   ├── cli.ts                  # CLI entry point
│   ├── index.ts                # Public API
│   ├── core/                   # Core analysis logic
│   ├── scanner/                # AST scanning and constant detection
│   ├── comparison/             # Duplicate comparison algorithms
│   ├── reporter/               # Output formatting (console, JSON)
│   ├── types/                  # TypeScript type definitions
│   └── utils/                  # Shared utilities
├── __tests__/                  # Test files
├── scripts/                    # Development scripts
└── dist/                       # Build output
```

## Types of Contributions

### Bug Fixes

1. **Search existing issues** to avoid duplicates
2. **Create a detailed issue** if one doesn't exist:
   - Clear description of the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment information (OS, Node version, etc.)
3. **Reference the issue** in your pull request
4. **Add or update tests** to prevent regression

### Feature Development

1. **Start with an issue** to discuss the feature
2. **Wait for feedback** from maintainers before starting development
3. **Follow the established patterns** in the codebase
4. **Write comprehensive tests**
5. **Update documentation** as needed

### Documentation

- Keep documentation in sync with code changes
- Use clear examples and step-by-step instructions
- Test all code examples to ensure they work

## Code Quality Standards

### File Conventions

| Export Type    | File Naming          | Example                 |
| -------------- | -------------------- | ----------------------- |
| Class          | PascalCase           | `Analyzer.ts`           |
| Function       | lowerCamelCase       | `scanConstants.ts`      |
| Constant       | SCREAMING_SNAKE_CASE | `DEFAULT_CONFIG.ts`     |
| Type/Interface | lowerCamelCase       | `constantsTypes.ts`     |
| Test           | Mirror source        | `scanConstants.test.ts` |

### Testing Guidelines

- Use **Vitest** for all tests
- One-to-one test file mapping: `src/scanner/scanConstants.ts` -> `__tests__/scanConstants.test.ts`
- Mock external dependencies; test real implementation
- Test both happy paths and edge cases
- Keep tests fast and deterministic

### File Length

- Maximum 250 lines per file
- Extract modules when exceeding the limit
- Never compress code to meet the limit

## Git Workflow

### Branch Naming

```bash
feature/add-monorepo-analysis
bugfix/fix-false-positive-detection
docs/update-api-reference
```

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```bash
feat: add cross-package duplicate detection
fix: resolve false positive for template literals
docs: update CLI usage examples
refactor: extract scanner utilities
test: add coverage for fuzzy matching
```

### Pull Request Process

1. **Create a descriptive PR title** following conventional commit format
2. **Fill out the PR description**:
   - What changes were made and why
   - How the changes were tested
   - Any breaking changes
3. **Ensure all checks pass**:
   - Development workflow passes
   - All tests pass
   - Build succeeds
   - No linting errors
4. **Request review** from maintainers
5. **Address feedback** promptly

### Git Hooks

The project includes automated Git hooks via Husky:

- **Pre-commit**: Runs linting and formatting checks
- **Pre-push**: Runs build and test validation

## Security

### Reporting Security Issues

**DO NOT** create public GitHub issues for security vulnerabilities. See [SECURITY.md](./SECURITY.md)
for reporting instructions.

### Development Security

- Never commit secrets (API keys, passwords, sensitive data)
- Use environment variables for configuration
- Validate all inputs
- Keep dependencies updated

## Getting Help

1. Check existing documentation
2. Search GitHub issues for similar problems
3. Ask specific questions with context and examples

## Recognition

All contributors are acknowledged in release notes. Significant contributors may be invited to
become maintainers.

## Additional Resources

- [Code of Conduct](./CODE_OF_CONDUCT.md) - Community standards
- [Security Policy](./SECURITY.md) - Reporting vulnerabilities
- [README](./README.md) - Project overview and usage
