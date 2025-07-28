-- Debug RLS Policies and Table Setup
-- Run these queries in the Supabase SQL Editor to check your setup

-- 1. Check if RLS is enabled on tables
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'admins', 'queries', 'messages');

-- 2. Check all RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public';

-- 3. Check the structure of the admins table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'admins'
ORDER BY ordinal_position;

-- 4. Check if there are any records in the admins table
SELECT 
    id,
    is_admin,
    created_at
FROM admins;

-- 5. Check the auth.users table to see your user
SELECT 
    id,
    email,
    email_confirmed_at,
    created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- 6. Create an admin record for your user (replace 'your-email@example.com' with your actual email)
-- Run this AFTER checking the above queries
/*
INSERT INTO admins (id, is_admin)
SELECT id, true
FROM auth.users
WHERE email = 'your-email@example.com'
ON CONFLICT (id) DO UPDATE SET is_admin = true;
*/

-- 7. Alternative: Check current user and make them admin
-- This shows your current user ID and creates admin record
/*
SELECT auth.uid() as current_user_id;

INSERT INTO admins (id, is_admin)
VALUES (auth.uid(), true)
ON CONFLICT (id) DO UPDATE SET is_admin = true;
*/

-- 8. Test the admin query that the app is trying to run
SELECT 
    is_admin
FROM admins 
WHERE id = auth.uid();
