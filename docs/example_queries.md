# Example Queries for RAGnosis

This document contains example questions to test the market intelligence chatbot and validate Phase 1 functionality.

**Target Audience:**
- Engineers learning about RAG technology
- CTOs/Architects evaluating RAG solutions
- Product managers researching RAG market trends

## Phase 1 Success Criteria

✅ 5+ example questions work correctly
✅ Source attribution (shows which model/repo/trend data answer came from)
✅ Answers are grounded in retrieved data (no hallucinations)
✅ Results are relevant to RAG ecosystem

---

## 🎓 Learning & Educational Questions

### 1. What are the top RAG models?

**Expected Answer Type:**
- List of popular RAG-related models from HuggingFace
- Should mention embedding models (sentence-transformers, BAAI/bge, etc.)
- Should cite download counts and popularity metrics

**Success Criteria:**
- ✅ Returns 3-5 RAG-related models
- ✅ Shows download/popularity metrics
- ✅ All models are actually RAG-related (embedding/retrieval models)
- ✅ Sources link to HuggingFace pages

---

### 2. What are the most popular RAG frameworks?

**Expected Answer Type:**
- List of GitHub repositories for RAG frameworks
- Should mention LangChain, LlamaIndex, Haystack, etc.
- Should cite star counts and descriptions

**Success Criteria:**
- ✅ Returns 3-5 RAG framework repos
- ✅ Shows GitHub stars
- ✅ Descriptions mention RAG/retrieval/vector search
- ✅ Sources link to GitHub repos

---

### 3. Which embedding models should I use for RAG?

**Expected Answer Type:**
- Specific embedding models optimized for semantic search
- Should mention sentence-transformers variants, BGE, etc.
- Should cite download metrics as proxy for adoption

**Success Criteria:**
- ✅ Lists embedding-specific models
- ✅ Mentions task type (feature-extraction, sentence-similarity)
- ✅ Provides popularity context
- ✅ All models suitable for RAG use cases

---

### 4. What are the best vector databases for RAG?

**Expected Answer Type:**
- GitHub repos for vector databases (Qdrant, Weaviate, Milvus, ChromaDB, etc.)
- Should mention stars, language, and descriptions
- Should focus on repos tagged with vector/database/search

**Success Criteria:**
- ✅ Returns vector database repos
- ✅ Shows popularity metrics (stars)
- ✅ Descriptions mention vector search/embeddings
- ✅ Diverse options (both hosted and self-hosted)

---

## 📊 Market Intelligence Questions

### 5. What are the RAG trends over time?

**Expected Answer Type:**
- Google Trends data showing interest in RAG-related keywords
- Should show trend lines (increasing/decreasing interest)
- Should cite dates and interest levels

**Success Criteria:**
- ✅ Returns Google Trends data
- ✅ Shows keywords like "RAG", "vector database", "semantic search"
- ✅ Provides temporal context (dates, interest percentages)
- ✅ Identifies rising vs stable trends

---

### 6. How popular is RAG compared to other AI technologies?

**Expected Answer Type:**
- Comparative metrics from HuggingFace downloads or GitHub stars
- Percentage of top models that are RAG-related
- Context about RAG's market position

**Success Criteria:**
- ✅ Provides comparative statistics
- ✅ Mentions specific numbers (X% of top models)
- ✅ Based on actual data (not hallucinated)
- ✅ Cites sources for comparison

---

### 7. Which companies are building RAG tools?

**Expected Answer Type:**
- Company/organization names from GitHub repo owners
- Should mention both startups and established companies
- Should cite specific repos they maintain

**Success Criteria:**
- ✅ Lists 3+ organizations
- ✅ Cites specific repos as evidence
- ✅ Mix of commercial and open-source projects
- ✅ All companies verifiable from GitHub data

---

### 8. What is the adoption trend for vector databases?

**Expected Answer Type:**
- GitHub star trends for vector database repos
- Google Trends data if available
- Comparison across different vector DB solutions

**Success Criteria:**
- ✅ Mentions specific vector databases
- ✅ Provides adoption metrics (stars, trends)
- ✅ Shows temporal data if available
- ✅ Grounded in actual data

---

## 🔧 Technical Decision Support

### 9. What are the most downloaded embedding models?

**Expected Answer Type:**
- Ranked list of embedding models by download count
- Should include model names, authors, and download numbers
- Should focus on models suitable for RAG

**Success Criteria:**
- ✅ Lists top embedding models
- ✅ Shows download counts
- ✅ All models are embedding/retrieval models
- ✅ Provides HuggingFace links

---

### 10. Which RAG repositories are most active?

**Expected Answer Type:**
- GitHub repos with high star counts
- Should mention activity indicators (stars, forks)
- Should focus on RAG-related repos

**Success Criteria:**
- ✅ Lists active repos
- ✅ Shows stars/forks as activity proxy
- ✅ All repos are RAG-related
- ✅ Diverse types (frameworks, tools, examples)

---

## 🧪 Edge Cases (Should Handle Gracefully)

### 11. Who won the 2024 Super Bowl?

**Expected Answer:**
"I don't have relevant data to answer this question. RAGnosis specializes in RAG/AI market intelligence. Try asking about:
- Popular RAG models and frameworks
- Vector database options
- RAG adoption trends
- Embedding model comparisons"

**Success Criteria:**
- ✅ Does NOT hallucinate an answer
- ✅ Clearly states insufficient information
- ✅ Suggests relevant RAG-focused questions

---

### 12. What is Python used for?

**Expected Answer:**
Should either:
- Return "insufficient information" if no RAG-related context found
- OR mention Python in context of GitHub repos if available (e.g., "According to GitHub data, Python is used in X RAG frameworks including...")

**Success Criteria:**
- ✅ No hallucinated general knowledge
- ✅ Grounds answer in RAG ecosystem data if possible
- ✅ Otherwise returns insufficient information message

---

## 🔬 Testing Protocol

### Manual Testing (Phase 1)

1. Verify local Supabase is running: `supabase status`
2. Test SQL search function directly:
   ```bash
   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
     -c "SELECT public.search_market_data('RAG', 5);" -t | python3 -m json.tool
   ```
3. Start edge function: `supabase functions serve --env-file .env --no-verify-jwt`
4. Test edge function:
   ```bash
   curl -X POST 'http://localhost:54321/functions/v1/rag-chat' \
     -H 'Content-Type: application/json' \
     -d '{"query":"top RAG models"}' | python3 -m json.tool
   ```
5. Launch Streamlit app: `streamlit run src/agent/research_agent.py`
6. Test each query above in the UI

### Quality Checklist

- [ ] 5+ queries return relevant RAG-related results
- [ ] Source attribution working (links to HuggingFace/GitHub)
- [ ] Edge cases handled gracefully (no hallucinations)
- [ ] Search filters correctly (RAG models don't include unrelated models)
- [ ] Metadata displays correctly (titles, authors, metrics)
- [ ] UI is responsive and clear

---

## 🎬 Phase 1 Demo Script

For live demos and portfolio presentations:

```
1. Start with: "What are the top RAG models?"
   → Shows core market intelligence functionality

2. Follow up: "What are the RAG trends?"
   → Demonstrates Google Trends integration

3. Ask: "Which RAG frameworks should I use?"
   → Shows GitHub repo search with star counts

4. Show sources panel
   → Point out links to HuggingFace/GitHub
   → Highlight download/star metrics

5. Ask edge case: "Who is the best basketball player?"
   → Shows graceful handling of out-of-scope questions

6. Highlight key features:
   - Market intelligence for RAG ecosystem
   - Multi-source data (HuggingFace, GitHub, Google Trends)
   - Source attribution with live links
   - Confidence thresholds to avoid hallucinations
```

---

## 📝 Expected Output Format

Each answer should follow this structure:

```
[Direct answer to question based on sources]

According to Source 1 (sentence-transformers/all-MiniLM-L6-v2), [specific metric/detail]...
Source 2 (LangChain framework) shows [specific detail about stars/adoption]...

[Summary or conclusion with market context]

Sources:
- [Model Name] by [Author] - [Download count] - [HuggingFace link]
- [Repo Name] by [Owner] - [Star count] - [GitHub link]
- [Trend Keyword] - [Interest level] - [Date]
```

---

## 🤖 Automated Testing (Phase 4)

Future enhancement: Create automated test suite using RAGAS

```python
# test_market_intelligence.py
test_cases = [
    {
        "question": "What are the top RAG models?",
        "expected_keywords": ["sentence-transformers", "embedding", "bge"],
        "expected_types": ["model"],
        "min_sources": 3,
        "all_rag_related": True  # All results should be RAG-related
    },
    {
        "question": "What are the most popular RAG frameworks?",
        "expected_keywords": ["langchain", "llamaindex", "haystack"],
        "expected_types": ["repo"],
        "min_sources": 3,
        "all_rag_related": True
    },
    {
        "question": "RAG trends",
        "expected_keywords": ["rag", "vector", "semantic search"],
        "expected_types": ["trend"],
        "min_sources": 1
    },
    {
        "question": "Who won the 2024 Super Bowl?",
        "expected_keywords": ["insufficient", "don't have"],
        "max_sources": 0,  # Should return no sources
        "should_fail_gracefully": True
    }
]

# Validation functions
def validate_rag_relevance(result):
    """Ensure result is actually RAG-related"""
    rag_keywords = ['rag', 'retrieval', 'embedding', 'vector', 'semantic', 'search']
    text = (result.get('description', '') + result.get('name', '')).lower()
    return any(keyword in text for keyword in rag_keywords)

def validate_metadata(result):
    """Ensure metadata is complete and correct"""
    required_fields = ['title', 'company']
    return all(result.get('metadata', {}).get(field) for field in required_fields)
```

This will be implemented in Phase 4 with EVALUATION.md

---

## 🐛 Known Issues & Debug Checklist

### Issue: Search returns non-RAG results

**Debug:**
```bash
# Check if is_rag_related is being used
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "SELECT COUNT(*) FROM hf_models WHERE is_rag_related = true;"

# Check search function logic
# Should check is_rag_related column when query contains "rag"
```

### Issue: Not enough results returned

**Debug:**
```bash
# Check data availability
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "SELECT COUNT(*) as models FROM hf_models WHERE is_rag_related = true;"
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "SELECT COUNT(*) as repos FROM github_repos WHERE is_rag_related = true;"
```

### Issue: Metadata errors in UI

**Debug:**
- Check edge function response format (line 61-73 in index.ts)
- Ensure all results have metadata.title and metadata.company
- Handle null/undefined values gracefully in UI

---

**Last Updated:** 2026-03-25
**Phase:** 1 (POC)
**Target Audience:** Engineers learning RAG, CTOs evaluating RAG solutions
