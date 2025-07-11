// Debug authentication flow for both regular and admin users
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
  console.error('❌ Missing Supabase credentials in .env.local file')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function debugAuthFlow() {
  console.log('🔍 DEBUGGING AUTHENTICATION FLOW\n')
  
  // Test users
  const users = [
    { email: 'nkabram@gmail.com', id: '69cd1ba7-761b-4e3e-8bd5-aad74faba83f', type: 'Admin' },
    { email: 'nick@kortex.ai', id: 'e323d6a3-b9ea-4c8f-8306-8b51bb115434', type: 'Regular' }
  ]
  
  for (const user of users) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`Testing ${user.type} User: ${user.email}`)
    console.log(`User ID: ${user.id}`)
    console.log('='.repeat(60))
    
    // 1. Check auth.users table
    console.log('\n1. Checking auth.users table...')
    try {
      const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(user.id)
      
      if (authError) {
        console.error('❌ Error fetching auth user:', authError)
      } else if (!authUser) {
        console.error('❌ No auth user found')
      } else {
        console.log('✅ Auth user found:')
        console.log(`   Email: ${authUser.user.email}`)
        console.log(`   Created: ${authUser.user.created_at}`)
        console.log(`   Last Sign In: ${authUser.user.last_sign_in_at}`)
      }
    } catch (error) {
      console.error('❌ Unexpected error:', error)
    }
    
    // 2. Check profiles table
    console.log('\n2. Checking profiles table...')
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      if (profileError) {
        console.error('❌ Error fetching profile:', profileError)
      } else if (!profile) {
        console.error('❌ No profile found')
      } else {
        console.log('✅ Profile found:')
        console.log(`   Email: ${profile.email}`)
        console.log(`   Is Approved: ${profile.is_approved}`)
        console.log(`   Created: ${profile.created_at}`)
        
        if (!profile.is_approved) {
          console.log('⚠️  WARNING: User is NOT approved!')
        }
      }
    } catch (error) {
      console.error('❌ Unexpected error:', error)
    }
    
    // 3. Check admins table
    console.log('\n3. Checking admins table...')
    try {
      const { data: adminRecords, error: adminError } = await supabase
        .from('admins')
        .select('*')
        .eq('user_id', user.id)
      
      if (adminError) {
        console.error('❌ Error fetching admin records:', adminError)
      } else if (!adminRecords || adminRecords.length === 0) {
        console.log('ℹ️  No admin record found (expected for regular users)')
      } else {
        console.log('✅ Admin record found:')
        adminRecords.forEach(record => {
          console.log(`   ID: ${record.id}`)
          console.log(`   Is Admin: ${record.is_admin}`)
          console.log(`   Created: ${record.created_at}`)
        })
      }
    } catch (error) {
      console.error('❌ Unexpected error:', error)
    }
    
    // 4. Simulate AuthContext checkApprovalStatus logic
    console.log('\n4. Simulating AuthContext logic...')
    try {
      // Check admin status first
      const { data: adminData, error: adminError } = await supabase
        .from('admins')
        .select('is_admin')
        .eq('user_id', user.id)
        .eq('is_admin', true)
      
      const isAdmin = adminData && adminData.length > 0
      
      if (isAdmin) {
        console.log('✅ User is admin - should be automatically approved')
        console.log('   Expected behavior: Access granted to main app')
      } else {
        // Check profile approval
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('is_approved')
          .eq('id', user.id)
          .single()
        
        if (profileError) {
          console.error('❌ Error checking approval:', profileError)
          console.log('   Expected behavior: Redirect to waiting-approval')
        } else {
          const isApproved = profileData?.is_approved || false
          if (isApproved) {
            console.log('✅ User is approved')
            console.log('   Expected behavior: Access granted to main app')
          } else {
            console.log('❌ User is NOT approved')
            console.log('   Expected behavior: Redirect to waiting-approval')
          }
        }
      }
    } catch (error) {
      console.error('❌ Unexpected error:', error)
    }
    
    // 5. Check for potential issues
    console.log('\n5. Checking for potential issues...')
    
    // Check if user has multiple admin records
    const { data: allAdminRecords, error: allAdminError } = await supabase
      .from('admins')
      .select('*')
      .eq('user_id', user.id)
    
    if (allAdminRecords && allAdminRecords.length > 1) {
      console.log('⚠️  WARNING: User has multiple admin records!')
      console.log(`   Count: ${allAdminRecords.length}`)
    }
    
    // Check if profile ID matches auth user ID
    const { data: profileCheck, error: profileCheckError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', user.email)
    
    if (profileCheck && profileCheck.length > 0) {
      profileCheck.forEach(p => {
        if (p.id !== user.id) {
          console.log('⚠️  WARNING: Found profile with different ID!')
          console.log(`   Profile ID: ${p.id}`)
          console.log(`   Expected ID: ${user.id}`)
        }
      })
    }
  }
  
  console.log('\n\n' + '='.repeat(60))
  console.log('SUMMARY OF FINDINGS')
  console.log('='.repeat(60))
  
  // Check RLS policies
  console.log('\n6. Checking RLS policies...')
  try {
    // Test if we can query with anon key (simulating client-side)
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (anonKey) {
      const anonClient = createClient(supabaseUrl, anonKey)
      
      // This should fail due to RLS
      const { data: testData, error: testError } = await anonClient
        .from('profiles')
        .select('*')
        .limit(1)
      
      if (testError) {
        console.log('✅ RLS is working - anonymous users cannot read profiles')
      } else {
        console.log('⚠️  WARNING: RLS might not be properly configured')
        console.log(`   Anonymous query returned ${testData?.length || 0} results`)
      }
    }
  } catch (error) {
    console.error('❌ Error testing RLS:', error)
  }
  
  console.log('\n✅ Debug complete!')
}

debugAuthFlow().catch(console.error)
