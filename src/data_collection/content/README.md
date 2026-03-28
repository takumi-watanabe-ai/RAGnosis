# Blog Content Scraping

Scrapes RAG-related blog articles from sitemaps for the RAGnosis knowledge base.

## Simple Structure

```
content/
├── sites.yaml         # Blog site definitions
├── filters.yaml       # Content filters (skip keywords, RAG topics)
├── blog_scraper.py    # Article scraper
└── blog_pipeline.py   # Main entry point
```

## Weekly Scraping

Runs automatically every Monday via GitHub Actions:
```bash
# Manual run
cd src/data_collection/content
python blog_pipeline.py
```

## Workflow

```
┌─────────────────────────────────────────────┐
│ 1. Fetch Sitemap XML                        │
│    - Gets all article URLs from sitemap      │
│    - Extracts lastmod dates                  │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│ 2. Filter Articles                           │
│    - Skip job posts, webinars, events       │
│    - Extract RAG topics (chunking, etc.)     │
│    - All articles must be RAG-related        │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│ 3. Store in SQL (blog_articles)              │
│    - Deduplication by URL                    │
│    - No duplicates allowed                   │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│ 4. Create Vector Embeddings                  │
│    - Run separately with 'make embed'        │
│    - Embeds title + full content             │
│    - Stores in ragnosis_docs (pgvector)      │
└─────────────────────────────────────────────┘
```

## Adding New Sites

Just add to `sites.yaml`:
```yaml
newsite:
  name: "New Site Blog"
  source_id: "newsite"
  sitemap_url: "https://newsite.com/sitemap.xml"
  url_pattern: "/blog/"  # Optional filter
  exclude_patterns:      # Optional exclusions
    - "/tags/"
    - "/authors/"
  enabled: true
  priority: 6
```

That's it! The scraper handles everything automatically.

## Configuration

### Content Filters (`filters.yaml`)
- `skip_keywords`: Auto-reject (e.g., "hiring", "job", "webinar")
- `rag_keywords`: Must contain at least one
- `rag_topics`: Topic extraction (e.g., "chunking", "embedding")

### Site Settings (`sites.yaml`)
- `enabled: true/false`: Turn sites on/off
- `priority`: Scraping order (not used yet)
- `url_pattern`: Filter URLs matching pattern
- `exclude_patterns`: Skip certain URL patterns

## Database Schema

Articles stored in `blog_articles`:
- `id`: SHA256 hash of URL (unique)
- `url`: Article URL (unique constraint)
- `title`, `author`, `published_at`, `content`, `excerpt`
- `source`: Site identifier (e.g., "langchain")
- `tags`: Article tags (usually empty)
- `rag_topics`: Extracted topics (e.g., ["chunking", "retrieval"])
- `scrape_method`: Always "sitemap"

Vector embeddings in `ragnosis_docs` with `doc_type="blog_article"`.

## Deduplication

- **SQL**: `url` has UNIQUE constraint
- **Vector**: Checked before embedding creation
- Articles are only inserted if URL doesn't exist

## Schedule

- **Weekly (Monday, 10 AM UTC)**: Blog scraping via GitHub Actions
- **As needed**: Vector embeddings via `make embed`
