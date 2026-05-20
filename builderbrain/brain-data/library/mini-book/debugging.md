# Debugging — Mini Book

## Systematic Approach
1. Reproduce the bug reliably — intermittent bugs need reproduction first
2. Isolate the minimal failing case
3. Read the full error including stack trace
4. Form a hypothesis about root cause
5. Test hypothesis with one change — not multiple
6. Verify the fix doesn't break related behavior

## Common Root Causes
- **Off-by-one errors**: Check array bounds, loop conditions, slice indices
- **Async race conditions**: Check if two async operations share state
- **Type coercion**: Check implicit conversions (== vs ===, number/string)
- **Missing null/undefined checks**: Check all external inputs
- **Stale closures**: Check if closure captures variable by reference vs value
- **Environment differences**: Check if bug only appears in prod (env vars, paths)

## Tools
- console.log with labels, not bare values
- Debugger breakpoints for complex async flows
- Bisect: comment out half the code to find which half breaks
- Check git log for recent changes near the bug location

## When Stuck
- Explain the bug out loud (rubber duck)
- Check if the issue is in a dependency, not your code
- Search self-learning memory for similar bug patterns
- Take a break — fresh eyes catch what tired eyes miss

## After Fixing
- Write a test that catches this bug
- Save the root cause and solution to bug-patterns.md
