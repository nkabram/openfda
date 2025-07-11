// Test authentication flow with specific users
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

async function testAuthFlow() {
  console.log('🧪 Testing authentication flow...\n')
  
  const adminUserId = '69cd1ba7-761b-4e3e-8bd5-aad74faba83f'
  const regularUserId = 'e323d6a3-b9ea-4c8f-8306-8b51bb115434'
  
  // Test 1: Verify admin user status
  console.log('1. Verifying admin user status...')
  try {
    // Check profile
    const { data: adminProfile, error: adminProfileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', adminUserId)
      .single()
    
    if (adminProfileError) {
      console.error('❌ Admin profile error:', adminProfileError)
    } else {
      console.log('✅ Admin profile:', {
        id: adminProfile.id,
        email: adminProfile.email,
        is_approved: adminProfile.is_approved
      })
    }
    
    // Check admin status
    const { data: adminStatus, error: adminStatusError } = await supabase
      .from('admins')
      .select('*')
      .eq('user_id', adminUserId)
      .single()
    
    if (adminStatusError) {
      console.error('❌ Admin status error:', adminStatusError)
    } else {
      console.log('✅ Admin status:', {
        user_id: adminStatus.user_id,
        is_admin: adminStatus.is_admin
      })
    }
  } catch (error) {
    console.error('❌ Admin verification error:', error)
  }
  
  // Test 2: Verify regular user status
  console.log('\n2. Verifying regular user status...')
  try {
    // Check profile
    const { data: userProfile, error: userProfileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', regularUserId)
      .single()
    
    if (userProfileError) {
      console.error('❌ Regular user profile error:', userProfileError)
    } else {
      console.log('✅ Regular user profile:', {
        id: userProfile.id,
        email: userProfile.email,
        is_approved: userProfile.is_approved
      })
    }
    
    // Check admin status (should not exist)
    const { data: userAdminStatus, error: userAdminError } = await supabase
      .from('admins')
      .select('*')
      .eq('user_id', regularUserId)
      .single()
    
    if (userAdminError) {
      console.log('✅ Regular user is not admin (expected error):', userAdminError.message)
    } else {
      console.log('⚠️ Unexpected: Regular user has admin record:', userAdminStatus)
    }
  } catch (error) {
    console.error('❌ Regular user verification error:', error)
  }
  
  // Test 3: Ensure both users are approved
  console.log('\n3. Ensuring both users are approved...')
  try {
    // Update admin profile
    const { error: adminUpdateError } = await supabase
      .from('profiles')
      .update({ is_approved: true })
      .eq('id', adminUserId)
    
    if (adminUpdateError) {
      console.error('❌ Admin approval update error:', adminUpdateError)
    } else {
      console.log('✅ Admin user approval confirmed')
    }
    
    // Update regular user profile
    const { error: userUpdateError } = await supabase
      .from('profiles')
      .update({ is_approved: true })
      .eq('id', regularUserId)
    
    if (userUpdateError) {
      console.error('❌ Regular user approval update error:', userUpdateError)
    } else {
      console.log('✅ Regular user approval confirmed')
    }
  } catch (error) {
    console.error('❌ Approval update error:', error)
  }
  
  console.log('\n🎉 Authentication flow test complete!')
}

testAuthFlow().catch(console.error)
