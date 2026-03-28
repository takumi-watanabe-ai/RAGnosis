# Golden Dataset v1.0

**Status:** 🔒 FROZEN (2026-03-28)
**Total Questions:** 28
**Purpose:** Stable baseline for RAGnosis evaluation

---

## Composition

| Query Type | Count | % |
|------------|-------|---|
| Implementation | 7 | 25% |
| Decision | 6 | 21% |
| Market Intelligence | 5 | 18% |
| Comparison | 4 | 14% |
| Edge Cases | 3 | 11% |
| Troubleshooting | 2 | 7% |
| Conceptual | 1 | 4% |

**Routing:** 22 semantic search, 4 top_models, 2 top_repos

---

## Baseline Metrics (2026-03-28)

| Metric | Score | Status |
|--------|-------|--------|
| context_recall | 0.57 | ✅ Solid baseline |
| context_precision | 0.57 | ✅ Solid baseline |
| faithfulness | 0.72 | ⚠️ Room to improve |
| answer_relevancy | 0.71 | ⚠️ Room to improve |
| source_count_accuracy | 1.00 | ✅ Perfect |

**Config:** qwen2.5:3b-instruct + BAAI/bge-small-en-v1.5 + Hybrid RRF + 5x boost

---

## Design Principles

✅ **Time-stable** - No exact numbers that change daily
✅ **Concept-focused** - Describes patterns and tradeoffs
✅ **Retrievable** - Ground truth matches what's in documents
✅ **Realistic** - Real user queries, not synthetic

---

## Usage

```bash
make eval-quick          # 10 questions
make eval-full           # All 28 questions
make eval-range RANGE=15:5  # Questions 15-19
```

---

## Update Policy

**DO NOT modify for:**
- ❌ Tweaking ground truth to match retrieval
- ❌ Removing "hard" questions
- ❌ Adding time-sensitive numbers

**Create v1.1 only if:**
- ✅ Fixing objectively incorrect ground truth
- ✅ Adding underrepresented query types
- ✅ Major system changes require new baseline

**Remember:** Improve the system, not the test.

---

## Changelog

**v1.0 (2026-03-28)** - Initial freeze
- 28 questions, 7 query types
- Time-stable ground truth (no exact counts)
- Baseline metrics established
