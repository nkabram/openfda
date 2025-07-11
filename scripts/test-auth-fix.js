// Test the auth fix for admin approval
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

async function testAuthFix() {
  console.log('🧪 Testing auth fix for admin approval...\n')
  
  const adminUserId = '69cd1ba7-761b-4e3e-8bd5-aad74faba83f'
  
  // Simulate the checkApprovalStatus function from AuthContext
  console.log('Simulating checkApprovalStatus function...')
  
  try {
    // Check profile approval status
    console.log('1. Checking profile approval status...')
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('is_approved')
      .eq('id', adminUserId)
      .single()
    
    if (profileError) {
      console.error('❌ Profile error:', profileError)
      console.log('Setting isApproved = false, isAdmin = false')
      return
    }
    
    // Set approval status from profile data
    const isApproved = profileData?.is_approved || false
    console.log(`✅ Profile approval status: ${isApproved}`)
    
    // Check admin status
    console.log('\n2. Checking admin status...')
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
    
    console.log('\n3. Final approval status:')
    console.log({
      profile_is_approved: isApproved,
      is_admin: isAdmin,
      final_is_approved: isApproved || isAdmin // Important: If user is admin, they should also be considered approved
    })
    
    // This is the key fix: If user is admin, they should also be considered approved
    const finalIsApproved = isApproved || isAdmin
    
    console.log(`\n✅ User would ${finalIsApproved ? 'PASS' : 'FAIL'} the approval check`)
    console.log(`✅ User would ${isAdmin ? 'PASS' : 'FAIL'} the admin check`)
    
  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
  
  console.log('\n🎉 Test complete!')
}

testAuthFix().catch(console.error)
