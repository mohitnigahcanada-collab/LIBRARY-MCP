# Safe Memory Policy

## What May Be Stored in User Style Memory
- Workflow preferences
- Communication style preferences
- Decision-making patterns
- Tool and framework preferences
- Response format preferences

## What Must NEVER Be Stored
- Passwords or credentials of any kind
- API keys or tokens
- Personal identification information (name, address, phone, email)
- Financial information
- Medical or health information
- Information about other people without their consent

## Enforcement
If a lesson or preference contains any prohibited data, reject it and notify the user.
The AI must check each new memory entry against this policy before saving.
