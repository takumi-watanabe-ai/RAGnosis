-- ============================================================================
-- Private Vector Search - Unified documents table
-- Internal implementation - no validation
-- ============================================================================

CREATE OR REPLACE FUNCTION private.search_documents(
    query_embedding vector(384),
    match_limit INTEGER,
    filter_doc_type TEXT,
    filter_rag_category TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_results JSONB;
BEGIN
    -- Call match_documents function and format results
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', d.id,
            'name', d.name,
            'description', d.description,
            'url', d.url,
            'doc_type', d.doc_type,
            'rag_category', d.rag_category,
            'topics', d.topics,
            'text', d.text,
            'similarity', d.similarity,
            'downloads', d.downloads,
            'stars', d.stars,
            'likes', d.likes,
            'forks', d.forks,
            'ranking_position', d.ranking_position,
            'author', d.author,
            'owner', d.owner,
            'language', d.language,
            'task', d.task,
            'published_at', d.published_at,
            'content_source', d.content_source,
            'snapshot_date', d.snapshot_date
        ) ORDER BY d.similarity DESC
    )
    INTO v_results
    FROM match_documents(
        query_embedding,
        match_limit,
        filter_doc_type,
        filter_rag_category
    ) d;

    RETURN COALESCE(v_results, '[]'::JSONB);
END;
$$;

COMMENT ON FUNCTION private.search_documents IS 'Internal vector search on unified documents table';

-- ============================================================================
-- Private Full-Text Search (BM25) - Unified documents table
-- Internal implementation - no validation
-- ============================================================================

CREATE OR REPLACE FUNCTION private.text_search_documents(
    search_query TEXT,
    match_limit INTEGER,
    filter_doc_type TEXT,
    filter_rag_category TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_results JSONB;
BEGIN
    -- Call text_search_documents function and format results
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', d.id,
            'name', d.name,
            'description', d.description,
            'url', d.url,
            'doc_type', d.doc_type,
            'rag_category', d.rag_category,
            'topics', d.topics,
            'text', d.text,
            'rank', d.rank,
            'downloads', d.downloads,
            'stars', d.stars,
            'likes', d.likes,
            'forks', d.forks,
            'ranking_position', d.ranking_position,
            'author', d.author,
            'owner', d.owner,
            'language', d.language,
            'task', d.task,
            'published_at', d.published_at,
            'content_source', d.content_source,
            'snapshot_date', d.snapshot_date
        ) ORDER BY d.rank DESC
    )
    INTO v_results
    FROM (
        SELECT
            documents.id,
            documents.name,
            documents.description,
            documents.url,
            documents.doc_type,
            documents.rag_category,
            documents.topics,
            documents.text,
            ts_rank_cd(
                setweight(to_tsvector('english', coalesce(documents.name, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(documents.description, '')), 'B') ||
                setweight(to_tsvector('english', coalesce(documents.text, '')), 'C'),
                websearch_to_tsquery('english', search_query)
            ) AS rank,
            documents.downloads,
            documents.stars,
            documents.likes,
            documents.forks,
            documents.ranking_position,
            documents.author,
            documents.owner,
            documents.language,
            documents.task,
            documents.published_at,
            documents.content_source,
            documents.snapshot_date
        FROM documents
        WHERE
            (
                to_tsvector('english', coalesce(documents.name, '')) ||
                to_tsvector('english', coalesce(documents.description, '')) ||
                to_tsvector('english', coalesce(documents.text, ''))
            ) @@ websearch_to_tsquery('english', search_query)
            AND (filter_doc_type IS NULL OR documents.doc_type = filter_doc_type)
            AND (filter_rag_category IS NULL OR documents.rag_category = filter_rag_category)
        ORDER BY rank DESC
        LIMIT match_limit
    ) d;

    RETURN COALESCE(v_results, '[]'::JSONB);
END;
$$;

COMMENT ON FUNCTION private.text_search_documents IS 'Internal full-text BM25 search on unified documents table';
