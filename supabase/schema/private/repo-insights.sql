-- Repository insights: Stack patterns and success analysis

-- Get common technology stacks (grouped topics)
CREATE OR REPLACE FUNCTION private.get_common_tech_stacks_internal()
RETURNS TABLE (
  stack_topics TEXT[],
  repo_count BIGINT,
  avg_stars NUMERIC,
  example_repos TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  WITH repo_topic_sets AS (
    SELECT
      r.id,
      r.repo_name,
      r.stars,
      r.topics
    FROM github_repos r
    WHERE r.topics IS NOT NULL
      AND array_length(r.topics, 1) >= 2
  ),
  stack_groups AS (
    SELECT
      topics as stack,
      COUNT(*) as count,
      ROUND(AVG(stars), 0) as avg_stars,
      ARRAY_AGG(repo_name ORDER BY stars DESC) as repos
    FROM repo_topic_sets
    GROUP BY topics
    HAVING COUNT(*) >= 2
  )
  SELECT
    sg.stack as stack_topics,
    sg.count as repo_count,
    sg.avg_stars,
    sg.repos[1:3] as example_repos
  FROM stack_groups sg
  ORDER BY sg.count DESC, sg.avg_stars DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;
