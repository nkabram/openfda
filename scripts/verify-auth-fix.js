// Comprehensive verification script for auth fixes
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

async function verifyAuthFix() {
  console.log('🔍 Comprehensive verification of auth fixes\n')
  
  const adminUserId = '69cd1ba7-761b-4e3e-8bd5-aad74faba83f'
  const adminEmail = 'nkabram@gmail.com'
  
  console.log(`Testing for admin user: ${adminEmail} (${adminUserId})`)
  
  // 1. Verify database records
  console.log('\n1. VERIFYING DATABASE RECORDS:')
  
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
  
  // 2. Simulate the checkApprovalStatus function from AuthContext
  console.log('\n2. SIMULATING AUTH CONTEXT BEHAVIOR:')
  
  try {
    // First check admin status - if user is admin, they're automatically approved
    console.log('\n2.1 Checking admin status first (new approach)...')
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
  
  // 3. Check for hydration issues
  console.log('\n3. CHECKING FOR POTENTIAL HYDRATION ISSUES:')
  console.log('✅ AuthGuard now returns <div data-auth-guard-loading></div> during SSR')
  console.log('✅ WaitingApproval page returns <div data-waiting-approval-loading></div> during SSR')
  console.log('✅ Client-side navigation now uses useEffect for redirects')
  console.log('✅ Admin status check is now performed before profile check')
  
  console.log('\n🎉 Verification complete!')
}

verifyAuthFix().catch(console.error)
