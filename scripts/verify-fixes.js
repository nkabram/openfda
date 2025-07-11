// Comprehensive verification of all fixes
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

const supabase = createClient(supabaseUrl, supabaseKey)

async function verifyFixes() {
  console.log('🔍 Verifying all fixes...\n')
  
  const adminUserId = '69cd1ba7-761b-4e3e-8bd5-aad74faba83f'
  const regularUserId = 'e323d6a3-b9ea-4c8f-8306-8b51bb115434'
  
  // Test 1: Verify user queries have proper user_id
  console.log('1. Verifying query ownership...')
  const { data: nullQueries } = await supabase
    .from('fda_queries')
    .select('id')
    .is('user_id', null)
  
  console.log(`✅ Queries with null user_id: ${nullQueries?.length || 0} (should be 0)`)
  
  const { data: adminQueries } = await supabase
    .from('fda_queries')
    .select('id')
    .eq('user_id', adminUserId)
  
  console.log(`✅ Admin user queries: ${adminQueries?.length || 0}`)
  
  // Test 2: Verify messages have proper user_id
  console.log('\n2. Verifying message ownership...')
  const { data: nullMessages } = await supabase
    .from('fda_messages')
    .select('id')
    .is('user_id', null)
  
  console.log(`✅ Messages with null user_id: ${nullMessages?.length || 0} (should be 0)`)
  
  // Test 3: Verify admin status check works
  console.log('\n3. Testing admin status check...')
  
  // Admin user
  let isAdminUser = false
  try {
    // Check profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_approved')
      .eq('id', adminUserId)
      .single()
    
    if (profile?.is_approved) {
      // Check admin status
      const { data: adminData } = await supabase
        .from('admins')
        .select('is_admin')
        .eq('user_id', adminUserId)
        .eq('is_admin', true)
      
      isAdminUser = adminData && adminData.length > 0
    }
  } catch (error) {
    console.error('❌ Admin check error:', error)
  }
  
  console.log(`✅ Admin user check: ${isAdminUser ? 'PASS' : 'FAIL'} (should be PASS)`)
  
  // Regular user
  let isRegularUserAdmin = false
  try {
    // Check profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_approved')
      .eq('id', regularUserId)
      .single()
    
    if (profile?.is_approved) {
      // Check admin status
      const { data: adminData } = await supabase
        .from('admins')
        .select('is_admin')
        .eq('user_id', regularUserId)
        .eq('is_admin', true)
      
      isRegularUserAdmin = adminData && adminData.length > 0
    }
  } catch (error) {
    console.error('❌ Regular user admin check error:', error)
  }
  
  console.log(`✅ Regular user admin check: ${isRegularUserAdmin ? 'FAIL' : 'PASS'} (should be PASS)`)
  
  // Test 4: Verify get_admin_queries function
  console.log('\n4. Testing get_admin_queries function...')
  try {
    const { data, error } = await supabase.rpc('get_admin_queries')
    
    if (error) {
      console.error('❌ get_admin_queries error:', error)
    } else {
      console.log(`✅ get_admin_queries returned ${data?.length || 0} queries`)
      
      // Check if user info is included
      if (data && data.length > 0) {
        const hasUserInfo = data.some(q => q.user_id && (q.user_email || q.user_name))
        console.log(`✅ User info included: ${hasUserInfo ? 'YES' : 'NO'} (should be YES)`)
      }
    }
  } catch (error) {
    console.error('❌ get_admin_queries error:', error)
  }
  
  console.log('\n🎉 Verification complete!')
}

verifyFixes().catch(console.error)
