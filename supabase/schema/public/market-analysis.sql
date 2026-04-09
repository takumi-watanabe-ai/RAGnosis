-- Public market structure analysis functions

-- Get language-topic matrix
CREATE OR REPLACE FUNCTION public.get_language_topic_matrix()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(row_to_json(t))
  INTO result
  FROM private.get_language_topic_matrix_internal() t;

  RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Get task analysis
CREATE OR REPLACE FUNCTION public.get_task_analysis()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(row_to_json(t))
  INTO result
  FROM private.get_task_analysis_internal() t;

  RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get model competitive positioning
CREATE OR REPLACE FUNCTION public.get_model_competitive_position()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(row_to_json(t))
  INTO result
  FROM private.get_model_competitive_position_internal() t;

  RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get repo competitive positioning
CREATE OR REPLACE FUNCTION public.get_repo_competitive_position()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(row_to_json(t))
  INTO result
  FROM private.get_repo_competitive_position_internal() t;

  RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get topic analysis (repos)
CREATE OR REPLACE FUNCTION public.get_topic_analysis()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(row_to_json(t))
  INTO result
  FROM private.get_topic_analysis_internal() t;

  RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

