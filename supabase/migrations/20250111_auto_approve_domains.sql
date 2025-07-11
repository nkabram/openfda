-- Create a function to auto-approve users from specific domains
CREATE OR REPLACE FUNCTION public.auto_approve_trusted_domains()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the email ends with trusted domains
  IF NEW.email LIKE '%@%.ah.org' OR NEW.email LIKE '%@umich.edu' THEN
    -- Update the is_approved field to true
    NEW.is_approved := true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger that runs before insert or update on profiles table
DROP TRIGGER IF EXISTS auto_approve_trusted_domains_trigger ON public.profiles;
CREATE TRIGGER auto_approve_trusted_domains_trigger
  BEFORE INSERT OR UPDATE OF email ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_approve_trusted_domains();

-- Also create a function to handle new user signups via auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user_auto_approve()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the email ends with trusted domains
  IF NEW.email LIKE '%@%.ah.org' OR NEW.email LIKE '%@umich.edu' THEN
    -- Insert into profiles with is_approved = true
    INSERT INTO public.profiles (id, email, full_name, is_approved, created_at, updated_at)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      true, -- Auto-approve for trusted domains
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET 
      email = EXCLUDED.email,
      is_approved = true,
      updated_at = NOW();
  ELSE
    -- For non-trusted domains, insert with default is_approved = false
    INSERT INTO public.profiles (id, email, full_name, is_approved, created_at, updated_at)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      false,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET 
      email = EXCLUDED.email,
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the existing trigger to use our new function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_auto_approve();

-- Apply auto-approval to existing users with trusted domains
UPDATE public.profiles
SET is_approved = true, updated_at = NOW()
WHERE (email LIKE '%@%.ah.org' OR email LIKE '%@umich.edu')
  AND is_approved = false;

-- Add a comment explaining the auto-approval policy
COMMENT ON FUNCTION public.auto_approve_trusted_domains() IS 
'Automatically approves users with email addresses from trusted domains: *.ah.org and umich.edu';
