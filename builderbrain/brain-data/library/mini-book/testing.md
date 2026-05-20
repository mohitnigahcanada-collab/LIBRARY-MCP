# Testing — Mini Book

## Principles
- Test behavior, not implementation details
- One assertion per test concept (multiple assertions in one test is fine if they verify the same behavior)
- Tests must be deterministic — no random data, no time-dependent assertions
- Fast tests run often; slow tests get skipped

## Test Structure (AAA)
- **Arrange**: Set up inputs and state
- **Act**: Call the function or system under test
- **Assert**: Verify the outcome

## What to Test
- Happy path: expected input, expected output
- Edge cases: empty input, null, zero, boundary values
- Error cases: invalid input, missing data, external failures
- Behavior contracts: what callers depend on

## What Not to Test
- Private implementation details that may change
- Third-party library internals
- Trivial getters/setters with no logic

## Common Mistakes
- Testing the mock instead of real behavior
- Tests that pass when the code is broken (false positives)
- Brittle tests that break on unrelated changes
- Not running tests before claiming done

## BuilderBrain Test Requirements
- Every engine function must have unit tests
- CLI commands must have integration tests
- API endpoints must have request/response tests
- Tests must pass before any task is marked complete
