-- User Approval System Setup

-- 1. Create profiles table for user approval status
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  is_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create admins table to track admin users
CREATE TABLE IF NOT EXISTS admins (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Insert the first admin user (replace with actual admin user ID)
INSERT INTO admins (id, is_admin) 
VALUES ('69cd1ba7-761b-4e3e-8bd5-aad74faba83f', TRUE)
ON CONFLICT (id) DO UPDATE SET is_admin = TRUE;

-- 4. Create function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create trigger to call the function on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS policies for profiles
-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE admins.id = auth.uid() 
      AND admins.is_admin = TRUE
    )
  );

-- Admins can update all profiles
CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE admins.id = auth.uid() 
      AND admins.is_admin = TRUE
    )
  );

-- 8. Enable RLS on admins table
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- 9. Create RLS policies for admins
-- Users can view their own admin status
CREATE POLICY "Users can view own admin status" ON admins
  FOR SELECT USING (auth.uid() = id);

-- Only admins can view all admin records
CREATE POLICY "Admins can view all admin records" ON admins
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admins 
      WHERE admins.id = auth.uid() 
      AND admins.is_admin = TRUE
    )
  );

-- 10. Update existing fda_queries RLS policies to include admin access
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own queries" ON fda_queries;
DROP POLICY IF EXISTS "Users can insert own queries" ON fda_queries;
DROP POLICY IF EXISTS "Users can update own queries" ON fda_queries;
DROP POLICY IF EXISTS "Users can delete own queries" ON fda_queries;

-- Create new policies that include admin access
CREATE POLICY "Users can view own queries or admins can view all" ON fda_queries
  FOR SELECT USING (
    auth.uid() = user_id OR 
    EXISTS (
      SELECT 1 FROM admins 
      WHERE admins.id = auth.uid() 
      AND admins.is_admin = TRUE
    )
  );

CREATE POLICY "Users can insert own queries" ON fda_queries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own queries" ON fda_queries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own queries" ON fda_queries
  FOR DELETE USING (auth.uid() = user_id);

-- 11. Update existing fda_messages RLS policies to include admin access
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own messages" ON fda_messages;
DROP POLICY IF EXISTS "Users can insert own messages" ON fda_messages;
DROP POLICY IF EXISTS "Users can update own messages" ON fda_messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON fda_messages;

-- Create new policies that include admin access
CREATE POLICY "Users can view own messages or admins can view all" ON fda_messages
  FOR SELECT USING (
    auth.uid() = user_id OR 
    EXISTS (
      SELECT 1 FROM admins 
      WHERE admins.id = auth.uid() 
      AND admins.is_admin = TRUE
    )
  );

CREATE POLICY "Users can insert own messages" ON fda_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own messages" ON fda_messages
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own messages" ON fda_messages
  FOR DELETE USING (auth.uid() = user_id);

-- 12. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_is_approved ON profiles(is_approved);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at);
CREATE INDEX IF NOT EXISTS idx_admins_is_admin ON admins(is_admin);
