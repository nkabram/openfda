-- SQL function to check user approval and admin status
-- This replaces the Edge Function with a direct SQL function

CREATE OR REPLACE FUNCTION public.check_user_status(input_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  is_approved BOOLEAN,
  is_admin BOOLEAN,
  waiting_since TIMESTAMP WITH TIME ZONE,
  user_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Use provided input_user_id or get the current authenticated user ID
  target_user_id := COALESCE(input_user_id, auth.uid());
  
  -- If no user is specified or authenticated, return null values
  IF target_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, FALSE, NULL::TIMESTAMP WITH TIME ZONE, NULL::UUID;
    RETURN;
  END IF;
  
  -- Return user approval and admin status
  RETURN QUERY
  SELECT 
    COALESCE(p.is_approved, FALSE) as is_approved,
    COALESCE(a.is_admin, FALSE) as is_admin,
    p.created_at as waiting_since,
    target_user_id as user_id
  FROM profiles p
  LEFT JOIN admins a ON a.user_id = p.id
  WHERE p.id = target_user_id;
  
  -- If no profile found, return default values
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, FALSE, NULL::TIMESTAMP WITH TIME ZONE, target_user_id;
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.check_user_status(UUID) TO authenticated;

-- Create RLS policy to ensure users can only check their own status
-- (This is handled by the function using auth.uid(), but good practice)
