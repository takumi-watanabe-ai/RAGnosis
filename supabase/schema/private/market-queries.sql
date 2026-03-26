-- RAGnosis Private Functions - Market Data Queries
-- Internal business logic - NOT directly accessible to users/edge functions
-- Small, composable functions for agentic orchestration

-- Get RAG-related models only
CREATE OR REPLACE FUNCTION private.get_rag_models(query_limit INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_models JSONB;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'type', 'model',
            'id', m.id,
            'name', m.model_name,
            'author', m.author,
            'downloads', m.downloads,
            'task', m.task,
            'description', COALESCE(m.description, m.task || ' model'),
            'url', m.url
        ) ORDER BY m.downloads DESC
    )
    INTO v_models
    FROM hf_models m
    WHERE m.is_rag_related = true
    LIMIT query_limit;

    RETURN COALESCE(v_models, '[]'::JSONB);
END;
$$;

-- Get RAG-related repos only
CREATE OR REPLACE FUNCTION private.get_rag_repos(query_limit INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_repos JSONB;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'type', 'repo',
            'id', r.id,
            'name', r.repo_name,
            'author', r.owner,
            'stars', r.stars,
            'forks', r.forks,
            'language', r.language,
            'description', r.description,
            'url', r.url
        ) ORDER BY r.stars DESC
    )
    INTO v_repos
    FROM github_repos r
    WHERE r.is_rag_related = true
    LIMIT query_limit;

    RETURN COALESCE(v_repos, '[]'::JSONB);
END;
$$;

-- Get top models by downloads (any category)
CREATE OR REPLACE FUNCTION private.get_top_models(
    query_limit INTEGER,
    min_downloads INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_models JSONB;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'type', 'model',
            'id', m.id,
            'name', m.model_name,
            'author', m.author,
            'downloads', m.downloads,
            'task', m.task,
            'description', COALESCE(m.description, m.task || ' model'),
            'url', m.url
        ) ORDER BY m.downloads DESC
    )
    INTO v_models
    FROM hf_models m
    WHERE m.downloads >= min_downloads
    LIMIT query_limit;

    RETURN COALESCE(v_models, '[]'::JSONB);
END;
$$;

-- Get top repos by stars (any topic)
CREATE OR REPLACE FUNCTION private.get_top_repos(
    query_limit INTEGER,
    min_stars INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_repos JSONB;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'type', 'repo',
            'id', r.id,
            'name', r.repo_name,
            'author', r.owner,
            'stars', r.stars,
            'forks', r.forks,
            'language', r.language,
            'description', r.description,
            'url', r.url
        ) ORDER BY r.stars DESC
    )
    INTO v_repos
    FROM github_repos r
    WHERE r.stars >= min_stars
    LIMIT query_limit;

    RETURN COALESCE(v_repos, '[]'::JSONB);
END;
$$;

-- Search models by text query (name, author, task, description)
CREATE OR REPLACE FUNCTION private.search_models(
    search_query TEXT,
    query_limit INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_models JSONB;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'type', 'model',
            'id', m.id,
            'name', m.model_name,
            'author', m.author,
            'downloads', m.downloads,
            'task', m.task,
            'description', COALESCE(m.description, m.task || ' model'),
            'url', m.url
        ) ORDER BY m.downloads DESC
    )
    INTO v_models
    FROM hf_models m
    WHERE m.model_name ILIKE '%' || search_query || '%'
       OR m.author ILIKE '%' || search_query || '%'
       OR m.task ILIKE '%' || search_query || '%'
       OR m.description ILIKE '%' || search_query || '%'
    LIMIT query_limit;

    RETURN COALESCE(v_models, '[]'::JSONB);
END;
$$;

-- Search repos by text query (name, description, topics)
CREATE OR REPLACE FUNCTION private.search_repos(
    search_query TEXT,
    query_limit INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_repos JSONB;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'type', 'repo',
            'id', r.id,
            'name', r.repo_name,
            'author', r.owner,
            'stars', r.stars,
            'forks', r.forks,
            'language', r.language,
            'description', r.description,
            'url', r.url
        ) ORDER BY r.stars DESC
    )
    INTO v_repos
    FROM github_repos r
    WHERE r.repo_name ILIKE '%' || search_query || '%'
       OR r.description ILIKE '%' || search_query || '%'
       OR search_query = ANY(r.topics)
    LIMIT query_limit;

    RETURN COALESCE(v_repos, '[]'::JSONB);
END;
$$;

-- Get models by task type
CREATE OR REPLACE FUNCTION private.get_models_by_task(
    task_name TEXT,
    query_limit INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_models JSONB;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'type', 'model',
            'id', m.id,
            'name', m.model_name,
            'author', m.author,
            'downloads', m.downloads,
            'task', m.task,
            'description', COALESCE(m.description, m.task || ' model'),
            'url', m.url
        ) ORDER BY m.downloads DESC
    )
    INTO v_models
    FROM hf_models m
    WHERE m.task ILIKE '%' || task_name || '%'
    LIMIT query_limit;

    RETURN COALESCE(v_models, '[]'::JSONB);
END;
$$;

-- Get repos by topic
CREATE OR REPLACE FUNCTION private.get_repos_by_topic(
    topic_name TEXT,
    query_limit INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_repos JSONB;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'type', 'repo',
            'id', r.id,
            'name', r.repo_name,
            'author', r.owner,
            'stars', r.stars,
            'forks', r.forks,
            'language', r.language,
            'description', r.description,
            'url', r.url
        ) ORDER BY r.stars DESC
    )
    INTO v_repos
    FROM github_repos r
    WHERE topic_name = ANY(r.topics)
    LIMIT query_limit;

    RETURN COALESCE(v_repos, '[]'::JSONB);
END;
$$;

-- Get trends data
CREATE OR REPLACE FUNCTION private.get_trends(query_limit INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_trends JSONB;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'type', 'trend',
            'keyword', t.keyword,
            'interest', t.current_interest,
            'date', t.snapshot_date,
            'category', t.category,
            'trend_direction', t.trend_direction
        ) ORDER BY t.current_interest DESC
    )
    INTO v_trends
    FROM google_trends t
    LIMIT query_limit;

    RETURN COALESCE(v_trends, '[]'::JSONB);
END;
$$;

-- Internal: Get market summary
CREATE OR REPLACE FUNCTION private.get_market_summary()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_total_models INTEGER;
    v_total_repos INTEGER;
    v_total_downloads BIGINT;
    v_total_stars BIGINT;
BEGIN
    SELECT COUNT(*), COALESCE(SUM(downloads), 0)
    INTO v_total_models, v_total_downloads
    FROM hf_models;

    SELECT COUNT(*), COALESCE(SUM(stars), 0)
    INTO v_total_repos, v_total_stars
    FROM github_repos;

    RETURN jsonb_build_object(
        'total_models', v_total_models,
        'total_repos', v_total_repos,
        'total_downloads', v_total_downloads,
        'total_stars', v_total_stars
    );
END;
$$;
