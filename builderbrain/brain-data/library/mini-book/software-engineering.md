# Software Engineering — Mini Book

## Core Principles
- Write code that is readable before it is clever
- Small, focused functions over large multi-purpose ones
- Explicit over implicit — name things clearly
- Don't add abstraction until you have 3+ concrete cases
- Delete unused code rather than commenting it out

## Design Patterns (When to Use)
- **Repository pattern**: when you need to swap data sources or test without a real DB
- **Strategy pattern**: when behavior varies by type and you need to add types without modifying core logic
- **Factory**: when object creation is complex or needs to vary
- Avoid patterns for their own sake — patterns solve specific problems

## Dependency Management
- Pin exact versions in production dependencies
- Audit dependencies before adding — prefer small, maintained packages
- Prefer stdlib over a package for simple operations

## Code Review Checklist
- Does it handle errors at system boundaries?
- Are there tests for the new behavior?
- Does it introduce any security vulnerabilities?
- Is the naming clear without a comment?
- Would a future reader understand WHY this code exists?

## Common Antipatterns
- God objects / files over 500 lines without clear sections
- Deeply nested conditionals (prefer early returns)
- Mutation of function arguments
- Catching all errors silently
- String-based configuration that should be typed
