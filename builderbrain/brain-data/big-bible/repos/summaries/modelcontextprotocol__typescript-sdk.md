# Repo Summary: modelcontextprotocol/typescript-sdk

## Topic
ai-agent-frameworks

## Status
quarantined

## What It Is
# MCP TypeScript SDK > [!IMPORTANT] **This is the `main` branch which contains v2 of the SDK (currently in development, pre-alpha).** > > We anticipate a stable v2 release in Q1 2026. Until then, **v1.x remains the recommended version** for production use. v1.x will continue to receive bug fixes and security updates for at least 6 months after v2 ships to give people time to upgrade.

## Why It Matters
Quality score: 83/100, Learning score: 85/100.

## Architecture Lessons
- README exists
- License: MIT
- Tests present
- Docs present
- Examples present
- Detected frameworks: GitHub Actions, MCP, Vitest

## Folder Structure Lessons
- .changeset
- .git
- .git-blame-ignore-revs
- .github
- .gitignore
- .npmrc
- .prettierignore
- .prettierrc.json
- CLAUDE.md
- CODE_OF_CONDUCT.md
- CONTRIBUTING.md
- LICENSE
- README.md
- REVIEW.md
- SECURITY.md
- common
- docs
- examples
- lefthook-local.example.yml
- lefthook.yml

## Testing Lessons
- Tests are present; inspect test style before implementing.

## Security Warnings
Risk level: Medium (34/100)
- [High] scripts/generate-multidoc.sh: Contains rm -rf command
- [Medium] packages/core/src/validators/cfWorkerProvider.ts: Contains eval usage
- [Medium] packages/client/src/client/stdio.ts: Contains sudo command

## Anti-Patterns
- Risk level Medium (34)

## How BuilderBrain Should Use This
- architecture
- patterns
- testing ideas

## License / Copying Warning
License: MIT (Low)
Do not copy directly unless project policy allows it.

## Final Verdict
Strong reference
