// Test authentication and database functions
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables from .env.local
const envPath = path.join(__dirname, '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=')
    if (key && value) {
      process.env[key.trim()] = value.trim()
    }
  })
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables')
  console.log('URL:', supabaseUrl ? 'Found' : 'Missing')
  console.log('Key:', supabaseKey ? 'Found' : 'Missing')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testAuth() {
  console.log('🧪 Testing authentication and database...')
  
  // Test 1: Check if check_user_status function exists and works
  console.log('\n1. Testing check_user_status function...')
  try {
    const { data, error } = await supabase.rpc('check_user_status')
    console.log('✅ check_user_status result:', { data, error })
  } catch (err) {
    console.error('❌ check_user_status error:', err)
  }
  
  // Test 2: Check profiles table
  console.log('\n2. Checking profiles table...')
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, is_approved')
      .limit(5)
    console.log('✅ Profiles:', { count: data?.length || 0, error })
    if (data) {
      data.forEach(p => console.log(`  - ${p.email}: approved=${p.is_approved}, id=${p.id}`))
    }
  } catch (err) {
    console.error('❌ Profiles error:', err)
  }
  
  // Test 3: Check admins table
  console.log('\n3. Checking admins table...')
  try {
    const { data, error } = await supabase
      .from('admins')
      .select('user_id, is_admin')
    console.log('✅ Admins:', { count: data?.length || 0, error })
    if (data) {
      data.forEach(a => console.log(`  - user_id=${a.user_id}: is_admin=${a.is_admin}`))
    }
  } catch (err) {
    console.error('❌ Admins error:', err)
  }
  
  // Test 4: Check queries table
  console.log('\n4. Checking fda_queries table...')
  try {
    const { data, error } = await supabase
      .from('fda_queries')
      .select('id, user_id, user_query, created_at')
      .order('created_at', { ascending: false })
      .limit(3)
    console.log('✅ Queries:', { count: data?.length || 0, error })
    if (data) {
      data.forEach(q => console.log(`  - Query ${q.id}: user_id=${q.user_id}, query="${q.user_query?.substring(0, 30)}..."`))
    }
  } catch (err) {
    console.error('❌ Queries error:', err)
  }
  
  // Test 5: Test get_admin_queries function
  console.log('\n5. Testing get_admin_queries function...')
  try {
    const { data, error } = await supabase.rpc('get_admin_queries')
    console.log('✅ get_admin_queries result:', { count: data?.length || 0, error })
    if (data && data.length > 0) {
      console.log('  - Sample query:', {
        id: data[0].id,
        user_id: data[0].user_id,
        user_email: data[0].user_email,
        user_name: data[0].user_name
      })
    }
  } catch (err) {
    console.error('❌ get_admin_queries error:', err)
  }
}

testAuth().catch(console.error)
