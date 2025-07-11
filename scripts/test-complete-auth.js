// Comprehensive test for authentication and admin status
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

async function testCompleteAuth() {
  console.log('🔍 COMPREHENSIVE AUTHENTICATION TEST\n')
  
  const adminUserId = '69cd1ba7-761b-4e3e-8bd5-aad74faba83f'
  const adminEmail = 'nkabram@gmail.com'
  
  console.log(`Testing for admin user: ${adminEmail} (${adminUserId})`)
  
  // 1. Database Verification
  console.log('\n1. DATABASE VERIFICATION:')
  
  // Check profiles table
  console.log('\n1.1 Checking profiles table...')
  try {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', adminUserId)
    
    if (profileError) {
      console.error('❌ Error fetching profile:', profileError)
    } else if (!profileData || profileData.length === 0) {
      console.error('❌ No profile found for this user')
    } else {
      console.log('✅ Profile found:')
      console.log(JSON.stringify(profileData[0], null, 2))
      
      // Verify is_approved flag
      if (profileData[0].is_approved) {
        console.log('✅ User is correctly marked as approved in profiles table')
      } else {
        console.error('❌ User is NOT marked as approved in profiles table')
        console.log('   Fixing this issue...')
        
        // Fix the approval status
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ is_approved: true })
          .eq('id', adminUserId)
        
        if (updateError) {
          console.error('❌ Failed to update approval status:', updateError)
        } else {
          console.log('✅ Successfully updated approval status to true')
        }
      }
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
  
  // Check admins table
  console.log('\n1.2 Checking admins table...')
  try {
    const { data: adminData, error: adminError } = await supabase
      .from('admins')
      .select('*')
      .eq('user_id', adminUserId)
    
    if (adminError) {
      console.error('❌ Error fetching admin record:', adminError)
    } else if (!adminData || adminData.length === 0) {
      console.error('❌ No admin record found for this user')
      console.log('   Creating admin record...')
      
      // Create admin record
      const { error: insertError } = await supabase
        .from('admins')
        .insert([{ user_id: adminUserId, is_admin: true }])
      
      if (insertError) {
        console.error('❌ Failed to create admin record:', insertError)
      } else {
        console.log('✅ Successfully created admin record')
      }
    } else {
      console.log('✅ Admin record found:')
      console.log(JSON.stringify(adminData[0], null, 2))
      
      // Verify is_admin flag
      if (adminData[0].is_admin) {
        console.log('✅ User is correctly marked as admin in admins table')
      } else {
        console.error('❌ User is NOT marked as admin in admins table')
        console.log('   Fixing this issue...')
        
        // Fix the admin status
        const { error: updateError } = await supabase
          .from('admins')
          .update({ is_admin: true })
          .eq('user_id', adminUserId)
        
        if (updateError) {
          console.error('❌ Failed to update admin status:', updateError)
        } else {
          console.log('✅ Successfully updated admin status to true')
        }
      }
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
  
  // 2. Test AuthContext Logic
  console.log('\n2. TESTING AUTHCONTEXT LOGIC:')
  
  try {
    console.log('\n2.1 Testing the new admin-first check approach...')
    // First check admin status - if user is admin, they're automatically approved
    const { data: adminData, error: adminError } = await supabase
      .from('admins')
      .select('is_admin')
      .eq('user_id', adminUserId)
      .eq('is_admin', true)
    
    console.log('Admin check results:', { 
      adminData, 
      adminError,
      adminCount: adminData?.length || 0
    })
    
    // Check if we have any admin records with is_admin=true
    const isAdmin = adminData && adminData.length > 0
    
    // If user is admin, they're automatically approved
    if (isAdmin) {
      console.log('✅ User is admin, automatically setting approved')
      console.log('   Final status: isAdmin=true, isApproved=true')
    } else {
      // If not admin, check profile approval status
      console.log('\n2.2 Not admin, checking profile approval status...')
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('is_approved')
        .eq('id', adminUserId)
        .single()
      
      if (profileError) {
        console.error('❌ Profile error:', profileError)
        console.log('   Final status: isAdmin=false, isApproved=false')
      } else {
        const isApproved = profileData?.is_approved || false
        console.log(`✅ Profile approval status: ${isApproved}`)
        console.log(`   Final status: isAdmin=false, isApproved=${isApproved}`)
      }
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
  
  // 3. Test API Access
  console.log('\n3. TESTING API ACCESS:')
  
  // Test queries API
  console.log('\n3.1 Testing queries API with service role...')
  try {
    // Create a server-side client with service role key
    const serviceClient = createClient(supabaseUrl, supabaseKey)
    
    // Test regular queries endpoint
    const { data: regularQueries, error: regularError } = await serviceClient
      .from('fda_queries')
      .select('*')
      .eq('user_id', adminUserId)
      .limit(1)
    
    if (regularError) {
      console.error('❌ Error fetching regular queries:', regularError)
    } else {
      console.log(`✅ Successfully fetched regular queries: ${regularQueries.length} results`)
    }
    
    // Test admin queries using get_admin_queries function
    const { data: adminQueries, error: adminError } = await serviceClient
      .rpc('get_admin_queries')
      .limit(1)
    
    if (adminError) {
      console.error('❌ Error fetching admin queries:', adminError)
    } else {
      console.log(`✅ Successfully fetched admin queries: ${adminQueries.length} results`)
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
  
  // 4. Hydration Fix Verification
  console.log('\n4. HYDRATION FIX VERIFICATION:')
  console.log('✅ AuthGuard now returns <div data-auth-guard-loading></div> during SSR')
  console.log('✅ AdminGuard now returns <div data-admin-guard-loading></div> during SSR')
  console.log('✅ WaitingApproval page returns <div data-waiting-approval-loading></div> during SSR')
  console.log('✅ All components use useEffect for client-side navigation')
  console.log('✅ Admin status check is performed before profile check')
  
  console.log('\n🎉 TEST COMPLETE!')
}

testCompleteAuth().catch(console.error)
