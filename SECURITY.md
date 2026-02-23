# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly.

**DO NOT** create public GitHub issues for security vulnerabilities.

### How to Report

1. **Email** the project maintainers with details of the vulnerability
2. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)
3. **Allow time** for a response — we aim to acknowledge reports within 48 hours

### What to Expect

- **Acknowledgment** within 48 hours of your report
- **Assessment** of the vulnerability's severity and impact
- **A fix or mitigation** as soon as reasonably possible
- **Credit** in the release notes (unless you prefer to remain anonymous)

## Security Best Practices for Users

When using constants-check in your projects:

- **Keep dependencies updated**: Run `npm audit` regularly
- **Use lockfiles**: Commit `package-lock.json` for reproducible installs
- **Pin versions in CI**: Use exact versions or lockfiles in automated pipelines

## Dependency Security

We monitor dependencies for known vulnerabilities through:

- **npm audit**: Regular audits of the dependency tree
- **GitHub Dependabot**: Automated security alerts and PRs
- **CI checks**: Security audits in the CI pipeline

---

**Last Updated**: February 2026
