# RAGnosis Evaluation

RAGAS-based evaluation system for the RAGnosis Edge Function. Tests retrieval quality, answer accuracy, and routing correctness using a comprehensive golden dataset.

## 📋 Overview

This evaluation framework tests:
- **Answer Quality**: Faithfulness, relevancy, and accuracy using RAGAS metrics
- **Retrieval Quality**: Context precision and recall
- **Routing Accuracy**: Correct query routing (SQL vs blog search)
- **Source Quality**: Appropriate number and relevance of sources
- **Error Handling**: Out-of-scope and edge case queries

## 🎯 Golden Dataset

The golden dataset (`golden_data/golden_dataset.jsonl`) contains **40 carefully crafted test cases**:

### Query Types
- **SQL/Market Intelligence** (14 questions): Top models, frameworks, trends
  - Example: "What are the top 5 embedding models by downloads?"

- **Blog/Implementation** (18 questions): How-to guides, troubleshooting, best practices
  - Example: "How to improve retrieval accuracy in RAG?"

- **Comparison** (3 questions): Framework and model comparisons
  - Example: "LangChain vs LlamaIndex for RAG"

- **Edge Cases** (6 questions): Out-of-scope, ambiguous, broad queries
  - Example: "What is the capital of France?" (should reject)

- **Mixed Queries** (3 questions): Combining market data with implementation guidance
  - Example: "What's the most popular embedding model and how do I use it?"

### Dataset Format

Each entry in the JSONL file contains:
```json
{
  "question_id": "sql_001",
  "question": "What are the top 5 embedding models by downloads?",
  "ground_truth": "The top 5 embedding models by downloads are...",
  "query_type": "sql_market",
  "expected_route": "top_models",
  "expected_sources": 5
}
```

## 🚀 Setup

### Prerequisites

1. **Python Virtual Environment**: Install evaluation dependencies
   ```bash
   python -m venv venv
   source venv/bin/activate
   pip install -r evaluation/requirements.txt
   ```

2. **Local Supabase**: Edge function must be running locally
   ```bash
   make chat  # Starts edge function + Streamlit UI
   ```

3. **Ollama**: Required for RAGAS evaluation
   ```bash
   docker compose up ollama -d

   # Pull required model
   docker compose exec ollama ollama pull qwen2.5:3b-instruct
   ```

## 📊 Running Evaluations

### Quick Evaluation (10 samples)

```bash
make eval-quick

# Or run directly
cd evaluation && python evaluate_ragnosis.py \
  --max_samples 10 \
  --save_predictions
```

### Full Evaluation (all 40 questions)

```bash
make eval-full

# Or run directly
cd evaluation && python evaluate_ragnosis.py \
  --save_predictions
```

### Custom Evaluation

```bash
# Run N samples from a specific section
make eval N=20 SECTION=sql_

# Run all samples from a section
make eval ALL=1 SECTION=blog_

# Or run directly with custom options
cd evaluation && python evaluate_ragnosis.py \
  --max_samples 20 \
  --top_k 5 \
  --llm_model qwen2.5:7b-instruct \
  --edge_function_url http://127.0.0.1:54321/functions/v1/rag-chat \
  --output_dir results \
  --save_predictions \
  --timeout 90
```

### Available Options

| Option | Default | Description |
|--------|---------|-------------|
| `--golden_data` | `evaluation/golden_data/golden_dataset.jsonl` | Path to golden dataset |
| `--max_samples` | `None` (all) | Limit number of test cases |
| `--top_k` | `5` | Number of sources to retrieve |
| `--llm_model` | `qwen2.5:3b-instruct` | Model for RAGAS evaluation |
| `--llm_base_url` | `http://localhost:11434` | Ollama URL |
| `--embedding_model` | `BAAI/bge-small-en-v1.5` | Embedding model for RAGAS |
| `--edge_function_url` | `http://127.0.0.1:54321/functions/v1/rag-chat` | Edge function endpoint |
| `--output_dir` | `evaluation/results` | Results directory |
| `--save_predictions` | `False` | Save detailed predictions |
| `--timeout` | `60` | Request timeout (seconds) |

## 📈 Metrics Explained

### RAGAS Metrics

1. **Faithfulness** (0.0 - 1.0)
   - Measures if answer is grounded in retrieved context
   - High score = answer doesn't hallucinate
   - Target: > 0.8

2. **Answer Relevancy** (0.0 - 1.0)
   - Measures if answer addresses the question
   - High score = directly answers user's query
   - Target: > 0.7

3. **Context Precision** (0.0 - 1.0)
   - Measures if retrieved chunks are relevant
   - High score = all retrieved docs are useful
   - Target: > 0.7

4. **Context Recall** (0.0 - 1.0)
   - Measures if retrieved context contains ground truth
   - High score = all info from ground truth is retrieved
   - Target: > 0.7

### Custom Metrics

1. **Route Accuracy**
   - Percentage of queries routed correctly (SQL vs blog vs vector)
   - Target: > 0.9

2. **Source Count Accuracy**
   - Percentage of queries returning expected number of sources
   - Target: > 0.8

3. **Error Rate**
   - Percentage of queries that resulted in errors
   - Target: < 0.05

## 📁 Output Files

Evaluation generates two output files in `evaluation/results/`:

### 1. Evaluation Results
`evaluation_results_YYYYMMDD_HHMMSS.json`
```json
{
  "edge_function_url": "http://127.0.0.1:54321/functions/v1/rag-chat",
  "llm_model": "qwen2.5:3b-instruct",
  "custom_metrics": {
    "total_questions": 40,
    "error_rate": 0.025,
    "route_accuracy": 0.925,
    "source_count_accuracy": 0.875
  },
  "ragas_metrics": {
    "faithfulness": 0.8234,
    "answer_relevancy": 0.7891,
    "context_precision": 0.7654,
    "context_recall": 0.8012
  }
}
```

### 2. Detailed Predictions (if `--save_predictions` used)
`predictions_YYYYMMDD_HHMMSS.json`
```json
[
  {
    "question_id": "sql_001",
    "question": "What are the top 5 embedding models?",
    "ground_truth": "The top 5 embedding models are...",
    "answer": "Based on download metrics...",
    "contexts": ["..."],
    "sources": [...],
    "num_sources": 5,
    "query_type": "sql_market",
    "expected_route": "top_models",
    "actual_route": "top_models",
    "has_error": false
  }
]
```

## 🔧 Troubleshooting

### Edge Function Not Responding

```bash
# Check if edge function is running
curl http://127.0.0.1:54321/functions/v1/rag-chat \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "top_k": 1}'

# Start if needed
make chat
```

### Ollama Connection Issues

```bash
# Check Ollama is running
docker compose ps ollama

# Test Ollama locally
curl http://localhost:11434/api/tags

# Restart Ollama if needed
docker compose restart ollama
```

### RAGAS Evaluation Fails

Common causes:
1. **Ollama model not pulled**: Run `docker compose exec ollama ollama pull qwen2.5:3b-instruct`
2. **Timeout too short**: Increase with `--timeout 120`
3. **No valid contexts**: Check if edge function is returning sources
4. **Missing dependencies**: Activate venv and install requirements

### Python Environment Issues

```bash
# Recreate virtual environment
rm -rf venv
python -m venv venv
source venv/bin/activate
pip install -r evaluation/requirements.txt
```

## 📝 Adding New Test Cases

To add new test cases to the golden dataset:

1. Edit `golden_data/golden_dataset.jsonl`
2. Add a new line with your test case in JSON format:
   ```json
   {"question_id": "sql_015", "question": "Your question?", "ground_truth": "Expected answer", "query_type": "sql_market", "expected_route": "top_models", "expected_sources": 5}
   ```

3. Run evaluation to test new cases

### Test Case Guidelines

- **question_id**: Unique ID (format: `{type}_{number}`)
- **question**: User query (test actual phrasing users might use)
- **ground_truth**: Expected answer (be specific, include metrics)
- **query_type**: One of `sql_market`, `blog_implementation`, `comparison`, `mixed`, `out_of_scope`, `ambiguous`
- **expected_route**: Expected routing (`top_models`, `top_repos`, `trends`, `blog_search`, `vector_search`)
- **expected_sources**: Exact count (for SQL) or use `expected_sources_min` (for blog queries)

## 🎯 Baseline Performance

Target metrics for RAGnosis v1.0:

| Metric | Target | Notes |
|--------|--------|-------|
| Faithfulness | > 0.80 | Answers grounded in sources |
| Answer Relevancy | > 0.75 | Directly answers question |
| Context Precision | > 0.70 | Retrieved docs are relevant |
| Context Recall | > 0.70 | Captures ground truth info |
| Route Accuracy | > 0.90 | Correct SQL vs blog routing |
| Source Count Accuracy | > 0.80 | Appropriate # of sources |
| Error Rate | < 0.05 | < 5% of queries fail |

## 🔄 Continuous Evaluation

### Before Deployment

```bash
# Run full evaluation before production deploy
make eval-full

# Check results
cat evaluation/results/evaluation_results_*.json | jq '.ragas_metrics'
```

### Regression Testing

```bash
# Test SQL queries only (first 14 questions)
make eval N=14

# Test SQL + blog queries (first 32 questions)
make eval N=32

# Test specific section
make eval ALL=1 SECTION=sql_
```

### A/B Testing

To compare different configurations:

```bash
# Baseline
cd evaluation && python evaluate_ragnosis.py \
  --top_k 5 --output_dir results/baseline --save_predictions

# Experiment with top_k=10
cd evaluation && python evaluate_ragnosis.py \
  --top_k 10 --output_dir results/experiment_topk10 --save_predictions

# Compare results
diff <(jq '.ragas_metrics' evaluation/results/baseline/evaluation_results_*.json) \
     <(jq '.ragas_metrics' evaluation/results/experiment_topk10/evaluation_results_*.json)
```

## 📚 References

- [RAGAS Documentation](https://docs.ragas.io/)
- [RAGAS Metrics Guide](https://docs.ragas.io/en/latest/concepts/metrics/index.html)
- [RAGnosis Documentation](../README.md)
- [Example Queries](../docs/example_queries.md)

## 🤝 Contributing

To improve the evaluation system:

1. Add more diverse test cases to golden dataset
2. Improve ground truth answers based on actual system responses
3. Add new custom metrics for specific use cases
4. Update baseline targets as system improves

---

**Last Updated**: 2026-03-27
**Golden Dataset**: 40 test cases (SQL, blog, comparison, edge cases, mixed)
**RAGAS Version**: 0.1.0+
**Evaluation Environment**: Local Ollama + Supabase Edge Functions
