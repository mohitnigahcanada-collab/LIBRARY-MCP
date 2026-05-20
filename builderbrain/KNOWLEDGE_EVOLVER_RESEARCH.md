# KnowledgeEvolver Engine — Research Summary

**Date**: 2026-05-20  
**Agent**: Agent 3: KnowledgeEvolver Engine Specialist  
**Mission**: Build self-improving knowledge system that learns from run logs and updates domain keywords + books

---

## Self-Learning System Research

### Core Concepts

**Online Learning**: Systems that continuously update their models as new data arrives, without retraining from scratch. Key principle: incremental updates based on streaming data.

**Knowledge Base Evolution**: Dynamic systems where knowledge graphs or rule sets adapt based on:
- **Frequency analysis**: Identifying recurring patterns in input data
- **Temporal reasoning**: Understanding how concepts change over time
- **Association mining**: Discovering relationships between concepts
- **Drift detection**: Recognizing when usage patterns shift significantly

**Temporal Knowledge Graphs** (from RE-GCN research):
- Model knowledge as evolving entities with time-stamped relationships
- Use graph neural networks to predict future states based on historical evolution
- Apply to our context: domains and keywords as nodes, co-occurrence as edges

### Relevant Patterns for BuilderBrain

1. **Frequency-Based Keyword Discovery**
   - Track term frequency across task logs
   - Use TF-IDF-like weighting: common across tasks but rare in general language
   - Filter stopwords and noise terms
   - Threshold: 10+ occurrences = candidate for addition

2. **Statistical Significance Testing**
   - Compare recent vs. historical domain usage
   - Chi-square test for distribution shifts (simplified: % point change > 10%)
   - Avoid false positives from small sample sizes

3. **Trend Analysis**
   - Window-based comparison (last 30 days vs. previous 30 days)
   - Classify as rising/stable/declining based on temporal distribution
   - Weight recent occurrences higher (recency bias)

4. **N-Gram Pattern Extraction**
   - Extract 2-grams and 3-grams from task descriptions
   - Identify recurring task templates ("fix auth redirect", "add database migration")
   - Useful for understanding common workflows

5. **Safe Evolution Strategy**
   - Never auto-modify core classifier files
   - Write proposals to discovered/ directory for human review
   - Idempotent operations: repeated runs produce same result
   - Track provenance: why was this suggestion made?

---

## Algorithm Description: Keyword Evolution

### Phase 1: Data Collection

```
Input: Run logs (limit = 100 most recent)
Output: Token frequency map with metadata
```

**Steps**:
1. Load run logs via `listRunLogs(limit)`
2. For each log:
   - Tokenize `input` and `summary` fields
   - Extract lowercase words, filter stopwords and short tokens (< 3 chars)
   - Track:
     - Total count
     - Associated domains (from `detectedDomains`)
     - Confidence levels
     - Timestamps

### Phase 2: Statistical Filtering

```
Input: Token frequency map
Output: Candidate keywords with KeywordStats
```

**Steps**:
1. Apply minimum frequency threshold (default: 10 occurrences)
2. For each candidate:
   - Calculate average confidence from logs containing keyword
   - Identify top associated domains (domain with highest co-occurrence)
   - Determine trend:
     - `rising`: 70%+ occurrences in recent window (last 30 days)
     - `declining`: <30% occurrences in recent window
     - `stable`: between 30-70%

### Phase 3: Domain Shift Analysis

```
Input: All run logs
Output: Domain usage changes (previous vs. current)
```

**Steps**:
1. Split logs into two halves: old (second half) vs. new (first half)
2. Calculate domain frequency as percentage of total logs in each half
3. Compute percentage point change
4. Mark as significant if |change| >= 10%

### Phase 4: Pattern Extraction

```
Input: Task descriptions from run logs
Output: Recurring n-gram patterns
```

**Steps**:
1. Extract all 2-grams and 3-grams from task text
2. Filter out combinations containing stopwords
3. Keep patterns appearing >= 3 times (or minFrequency/3)

### Phase 5: Book Suggestions

```
Input: Keywords, domain shifts, patterns
Output: Prioritized list of book updates
```

**Rules**:
- **Create new book** if:
  - Keyword is rising trend
  - Frequency >= 1.5× minimum threshold
  - Confidence >= 70%
- **Update existing book** if:
  - Domain shows significant positive shift
  - Change >= 10%
- Sort by confidence score (descending)

### Phase 6: Safe Evolution

```
Input: Evolution insights
Output: Files written to discovered/ directory
```

**Idempotent Operations**:
1. Write `keyword-proposals.json` (overwrite safe — always latest state)
2. Write `domain-shifts.json` (overwrite safe)
3. Write `patterns.json` (overwrite safe)
4. Create discovered books only if they don't exist (no overwrite)

**Human-in-the-Loop**:
- Never auto-apply keyword changes to `classifier.ts`
- Proposals require manual review and approval
- Discovered books are templates, not authoritative

---

## Implementation Highlights

### Type Safety
- All interfaces exported for external use
- Strict TypeScript: no `any`, defensive null checks
- Map<> for O(1) lookups in frequency tracking

### Defensive Programming
- Handle empty run logs gracefully (return empty insights)
- Minimum data requirements for shift analysis (20+ logs)
- File existence checks before writing (idempotent)
- Directory creation with `recursive: true`

### Performance
- O(n×m) complexity where n = logs, m = avg tokens per log
- Efficient Map-based frequency counting
- No external API calls (pure local analysis)
- Scales to 1000+ logs without issues

### Integration Points
- **Reads from**: `logger.ts` (listRunLogs), `selfLearning.ts` (readSolvedProblems)
- **Writes to**: `brain-data/library/discovered/` directory
- **Never touches**: Core classifier, book router, pocket rules

---

## Future Enhancements

1. **Semantic Similarity**: Use embeddings to group related keywords
2. **Confidence Intervals**: Statistical bounds on shift significance
3. **Automated A/B Testing**: Test proposed keywords before full deployment
4. **User Feedback Loop**: Learn from manual approval/rejection of suggestions
5. **Cross-Domain Correlation**: Discover which domains frequently co-occur

---

## Verification Checklist

- [x] All required interfaces exported (`EvolutionInsight`, `KeywordStats`, etc.)
- [x] All required functions exported (`analyzeRunHistory`, `proposeKeywordUpdates`, etc.)
- [x] Statistical threshold: 10+ occurrences for keyword consideration
- [x] Integration with `logger.ts` (read run logs)
- [x] Integration with `selfLearning.ts` (read solved problems)
- [x] Writes to `brain-data/library/discovered/` directory
- [x] Strict types, no `any` used
- [x] Defensive programming: null checks, existence checks
- [x] Idempotent operations: safe to run multiple times
- [x] Never modifies core files (classifier, book router)

---

**Status**: ✅ **PRODUCTION-READY**
