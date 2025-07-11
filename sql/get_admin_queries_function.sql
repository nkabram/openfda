-- Function to get all queries with user information for admin view
CREATE OR REPLACE FUNCTION public.get_admin_queries()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  user_email text,
  user_name text,
  user_query text,
  medication_name text,
  fda_response jsonb,
  ai_response jsonb,
  created_at timestamp with time zone,
  message_count integer,
  fda_raw_data jsonb,
  fda_sections_used jsonb,
  detected_intents jsonb
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    q.id,
    q.user_id,
    p.email as user_email,
    p.full_name as user_name,
    q.user_query,
    q.medication_name,
    q.fda_response,
    q.ai_response,
    q.created_at,
    q.message_count,
    q.fda_raw_data,
    q.fda_sections_used,
    q.detected_intents
  FROM 
    fda_queries q
  LEFT JOIN 
    profiles p ON q.user_id = p.id
  ORDER BY 
    q.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_admin_queries() TO authenticated;

-- Comment on function
COMMENT ON FUNCTION public.get_admin_queries() IS 'Returns all queries with user information for admin view';
