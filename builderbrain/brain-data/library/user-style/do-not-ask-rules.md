# Do Not Ask Rules

<!-- These are actions the AI can take without asking -->

## Autonomous Actions (No Approval Needed)
- Create new source files
- Write or update TypeScript code in src/
- Run `npm install`, `npm test`, `npm run build`
- Save lessons to self-learning memory
- Create run logs in brain-data/runs/
- Read any file in the repository
- Search the codebase
- Start local development servers

## Always Ask Before
- Deleting any file
- Modifying files outside the builderbrain/ directory
- Running commands that affect system state outside the project
- Any deployment action
- Changing authentication or security logic

_Edit this file to capture your own preferences via `brain learn`._
