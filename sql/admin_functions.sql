-- Admin functions for user management
-- These functions are designed to be called by admin users only

CREATE OR REPLACE FUNCTION public.get_pending_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID;
  is_user_admin BOOLEAN;
BEGIN
  -- Get the current authenticated user ID
  current_user_id := auth.uid();
  
  -- Check if current user is admin
  SELECT COALESCE(a.is_admin, FALSE) INTO is_user_admin
  FROM admins a
  WHERE a.id = current_user_id;
  
  -- If user is not admin, return empty result
  IF NOT COALESCE(is_user_admin, FALSE) THEN
    RETURN;
  END IF;
  
  -- Return pending users (only for admin users)
  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.full_name,
    p.created_at
  FROM profiles p
  ORDER BY p.created_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_user_approval(
  target_user_id UUID,
  approve_user BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID;
  is_user_admin BOOLEAN;
  update_success BOOLEAN := FALSE;
BEGIN
  -- Get the current authenticated user ID
  current_user_id := auth.uid();
  
  -- Check if current user is admin
  SELECT COALESCE(a.is_admin, FALSE) INTO is_user_admin
  FROM admins a
  WHERE a.id = current_user_id;
  
  -- If user is not admin, return false
  IF NOT COALESCE(is_user_admin, FALSE) THEN
    RETURN FALSE;
  END IF;
  
  
  -- Check if update was successful
  GET DIAGNOSTICS update_success = FOUND;
  
  RETURN update_success;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_approval(UUID, BOOLEAN) TO authenticated;
