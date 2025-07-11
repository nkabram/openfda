// Final comprehensive test
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

async function finalTest() {
  console.log('🧪 Final comprehensive test...\n')
  
  const adminUserId = '69cd1ba7-761b-4e3e-8bd5-aad74faba83f'
  const regularUserId = 'e323d6a3-b9ea-4c8f-8306-8b51bb115434'
  
  // Test 1: Check admin user queries
  console.log('1. Testing admin user queries...')
  const { data: adminQueries, error: adminError } = await supabase
    .from('fda_queries')
    .select('id, user_id, user_query')
    .eq('user_id', adminUserId)
    .limit(3)
  
  console.log(`✅ Admin has ${adminQueries?.length || 0} queries`)
  if (adminError) console.error('❌ Admin query error:', adminError)
  
  // Test 2: Check regular user queries
  console.log('\n2. Testing regular user queries...')
  const { data: regularQueries, error: regularError } = await supabase
    .from('fda_queries')
    .select('id, user_id, user_query')
    .eq('user_id', regularUserId)
    .limit(3)
  
  console.log(`✅ Regular user has ${regularQueries?.length || 0} queries`)
  if (regularError) console.error('❌ Regular query error:', regularError)
  
  // Test 3: Test admin status check
  console.log('\n3. Testing admin status...')
  const { data: adminCheck, error: adminCheckError } = await supabase
    .from('profiles')
    .select(`
      is_approved,
      admins!inner(is_admin)
    `)
    .eq('id', adminUserId)
    .single()
  
  if (adminCheckError) {
    console.log('❌ Admin check with JOIN failed, trying separate queries...')
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_approved')
      .eq('id', adminUserId)
      .single()
    
    const { data: admin } = await supabase
      .from('admins')
      .select('is_admin')
      .eq('user_id', adminUserId)
      .single()
    
    console.log('✅ Admin status (separate queries):', {
      is_approved: profile?.is_approved,
      is_admin: admin?.is_admin
    })
  } else {
    console.log('✅ Admin status (JOIN):', adminCheck)
  }
  
  // Test 4: Test get_admin_queries function
  console.log('\n4. Testing get_admin_queries function...')
  const { data: allQueries, error: allQueriesError } = await supabase.rpc('get_admin_queries')
  
  if (allQueriesError) {
    console.error('❌ get_admin_queries error:', allQueriesError)
  } else {
    console.log(`✅ get_admin_queries returned ${allQueries?.length || 0} queries`)
    if (allQueries && allQueries.length > 0) {
      const sample = allQueries[0]
      console.log('Sample query:', {
        id: sample.id,
        user_id: sample.user_id,
        user_email: sample.user_email || 'No email',
        user_name: sample.user_name || 'No name'
      })
    }
  }
  
  // Test 5: Check for any remaining null user_ids
  console.log('\n5. Checking for orphaned data...')
  const { data: orphanedQueries } = await supabase
    .from('fda_queries')
    .select('id')
    .is('user_id', null)
  
  const { data: orphanedMessages } = await supabase
    .from('fda_messages')
    .select('id')
    .is('user_id', null)
  
  console.log(`✅ Orphaned queries: ${orphanedQueries?.length || 0}`)
  console.log(`✅ Orphaned messages: ${orphanedMessages?.length || 0}`)
  
  console.log('\n🎉 Test complete!')
}

finalTest().catch(console.error)
