# AI Agents — Mini Book

## Core Idea
AI agents need context before coding, not after. The quality of output is proportional to the quality of context provided upfront.

## Context Pack Pattern
Before any AI agent executes:
1. Classify the task domain
2. Select relevant knowledge sources (book stack)
3. Build a structured context pack
4. Calculate confidence and risk
5. Get approval if risk is High/Critical
6. Execute with full context
7. Verify output
8. Save lessons

## Risk Management
- Low risk: execute autonomously
- Medium risk: execute but flag for review
- High risk: present proposal, wait for approval
- Critical risk: never execute without explicit sign-off

## Confidence Scoring
- High confidence (70-100): clear domain, multiple matching books, prior solved lessons
- Medium confidence (40-69): partially matching domain, some relevant knowledge
- Low confidence (0-39): unclear domain, no matching lessons, novel problem

## Self-Learning Loop
Every task generates a lesson. Over time:
- Solved problems become reference solutions
- Failed attempts prevent repeated mistakes
- Bug patterns accelerate debugging
- Architecture decisions guide future structure

## Antipatterns
- Coding without classifying the domain first
- Using a single knowledge source (use a stack)
- Ignoring risk level and executing blindly
- Not saving lessons after resolution
- Claiming task complete without verification
- Adding v2 features while building v1
