# Approval Rules

## Requires Approval (High / Critical Risk)
- Deleting files or directories
- Modifying database schemas or running migrations
- Changing authentication or authorization logic
- Deploying to production or staging
- Adding or removing environment variables in production
- Installing packages with broad system access
- Modifying CI/CD pipelines
- Any irreversible operation

## Safe to Execute Autonomously (Low / Medium Risk)
- Creating new files
- Writing or modifying source code in development
- Running npm install, npm test, npm run build
- Reading files, searching code, listing directories
- Saving lessons to self-learning memory
- Creating run logs
- Starting local servers (API, dashboard)

## Rule
When risk is High or Critical, stop and present the proposal for explicit approval before executing.
