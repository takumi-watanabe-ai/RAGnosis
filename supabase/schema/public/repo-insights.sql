-- Public repository insights functions

-- Get common tech stacks
CREATE OR REPLACE FUNCTION public.get_common_tech_stacks()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(row_to_json(t))
  INTO result
  FROM private.get_common_tech_stacks_internal() t;

  RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
