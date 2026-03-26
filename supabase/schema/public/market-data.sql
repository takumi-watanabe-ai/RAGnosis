-- RAGnosis Public API Functions - Market Data Queries
-- Public interface - validates input and delegates to private schema
-- Small, composable functions for agentic orchestration

-- Get RAG-related models
CREATE OR REPLACE FUNCTION public.get_rag_models(
    query_limit INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    IF query_limit < 1 OR query_limit > 100 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Limit must be between 1 and 100');
    END IF;

    v_result := private.get_rag_models(query_limit);

    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object('results', v_result, 'count', jsonb_array_length(v_result))
    );
END;
$$;

-- Get RAG-related repos
CREATE OR REPLACE FUNCTION public.get_rag_repos(
    query_limit INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    IF query_limit < 1 OR query_limit > 100 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Limit must be between 1 and 100');
    END IF;

    v_result := private.get_rag_repos(query_limit);

    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object('results', v_result, 'count', jsonb_array_length(v_result))
    );
END;
$$;

-- Get top models by downloads
CREATE OR REPLACE FUNCTION public.get_top_models(
    query_limit INTEGER DEFAULT 10,
    min_downloads INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    IF query_limit < 1 OR query_limit > 100 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Limit must be between 1 and 100');
    END IF;

    v_result := private.get_top_models(query_limit, min_downloads);

    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object('results', v_result, 'count', jsonb_array_length(v_result))
    );
END;
$$;

-- Get top repos by stars
CREATE OR REPLACE FUNCTION public.get_top_repos(
    query_limit INTEGER DEFAULT 10,
    min_stars INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    IF query_limit < 1 OR query_limit > 100 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Limit must be between 1 and 100');
    END IF;

    v_result := private.get_top_repos(query_limit, min_stars);

    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object('results', v_result, 'count', jsonb_array_length(v_result))
    );
END;
$$;

-- Search models by text
CREATE OR REPLACE FUNCTION public.search_models(
    search_query TEXT,
    query_limit INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    IF search_query IS NULL OR LENGTH(TRIM(search_query)) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Search query is required');
    END IF;

    IF query_limit < 1 OR query_limit > 100 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Limit must be between 1 and 100');
    END IF;

    v_result := private.search_models(search_query, query_limit);

    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object('results', v_result, 'count', jsonb_array_length(v_result))
    );
END;
$$;

-- Search repos by text
CREATE OR REPLACE FUNCTION public.search_repos(
    search_query TEXT,
    query_limit INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    IF search_query IS NULL OR LENGTH(TRIM(search_query)) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Search query is required');
    END IF;

    IF query_limit < 1 OR query_limit > 100 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Limit must be between 1 and 100');
    END IF;

    v_result := private.search_repos(search_query, query_limit);

    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object('results', v_result, 'count', jsonb_array_length(v_result))
    );
END;
$$;

-- Get models by task type
CREATE OR REPLACE FUNCTION public.get_models_by_task(
    task_name TEXT,
    query_limit INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    IF task_name IS NULL OR LENGTH(TRIM(task_name)) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Task name is required');
    END IF;

    IF query_limit < 1 OR query_limit > 100 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Limit must be between 1 and 100');
    END IF;

    v_result := private.get_models_by_task(task_name, query_limit);

    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object('results', v_result, 'count', jsonb_array_length(v_result))
    );
END;
$$;

-- Get repos by topic
CREATE OR REPLACE FUNCTION public.get_repos_by_topic(
    topic_name TEXT,
    query_limit INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    IF topic_name IS NULL OR LENGTH(TRIM(topic_name)) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Topic name is required');
    END IF;

    IF query_limit < 1 OR query_limit > 100 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Limit must be between 1 and 100');
    END IF;

    v_result := private.get_repos_by_topic(topic_name, query_limit);

    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object('results', v_result, 'count', jsonb_array_length(v_result))
    );
END;
$$;

-- Get Google Trends data
CREATE OR REPLACE FUNCTION public.get_trends_data(
    query_limit INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    IF query_limit < 1 OR query_limit > 100 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Limit must be between 1 and 100');
    END IF;

    v_result := private.get_trends(query_limit);

    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object('results', v_result, 'count', jsonb_array_length(v_result))
    );
END;
$$;

-- Get market summary (dashboard stats)
CREATE OR REPLACE FUNCTION public.get_market_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    v_result := private.get_market_summary();

    RETURN jsonb_build_object(
        'success', true,
        'data', v_result
    );
END;
$$;
