-- Create RPC function to apply auto-approval to existing users
CREATE OR REPLACE FUNCTION public.apply_auto_approval_to_existing_users()
RETURNS json AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Update profiles for users with trusted domain emails
  UPDATE public.profiles
  SET is_approved = true, updated_at = NOW()
  WHERE (email LIKE '%@%.ah.org' OR email LIKE '%@umich.edu')
    AND is_approved = false;
  
  -- Get the number of rows updated
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  -- Return result as JSON
  RETURN json_build_object(
    'success', true,
    'updated_count', updated_count,
    'message', format('Approved %s users from trusted domains', updated_count)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (will be restricted by API)
GRANT EXECUTE ON FUNCTION public.apply_auto_approval_to_existing_users() TO authenticated;

-- Create a function to check if an email is from a trusted domain
CREATE OR REPLACE FUNCTION public.is_trusted_domain(email_address TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN email_address LIKE '%@%.ah.org' OR email_address LIKE '%@umich.edu';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add index on email column for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_email_pattern ON public.profiles (email);

-- Add comment
COMMENT ON FUNCTION public.is_trusted_domain(TEXT) IS 
'Checks if an email address belongs to a trusted domain (*.ah.org or umich.edu)';
