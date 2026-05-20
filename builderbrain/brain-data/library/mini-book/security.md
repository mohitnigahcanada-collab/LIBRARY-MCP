# Security — Mini Book

## Input Validation
- Validate all external inputs at system boundaries (CLI args, API requests, file reads)
- Never trust user-provided data without validation
- Use allowlists over denylists for input validation

## Common Vulnerabilities (OWASP Top 10)
- **Injection**: Never interpolate user input into shell commands or SQL — use parameterized queries and safe APIs
- **Broken Auth**: Use established auth libraries; don't roll your own
- **Sensitive Data Exposure**: Never log passwords, tokens, or PII
- **Path Traversal**: Sanitize file paths; prevent `../` escapes
- **Dependency vulnerabilities**: Run `npm audit` regularly

## Secrets Management
- Never hardcode credentials in source code
- Never commit .env files to git
- Use environment variables for all secrets
- Never store secrets in memory files or run logs

## BuilderBrain Specific
- approval-rules.md governs which operations require sign-off
- Never run unknown code from external sources (v1 constraint)
- Memory files must never contain sensitive personal data
- Run logs must not contain secrets or credentials

## Security Review Checklist
- [ ] No hardcoded credentials
- [ ] All external inputs validated
- [ ] No shell injection via user input
- [ ] Secrets not logged
- [ ] Dependencies audited
