// Check admin user status directly in the database
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

async function checkAdminStatus() {
  console.log('🔍 Checking admin user status directly in database...\n')
  
  const adminUserId = '69cd1ba7-761b-4e3e-8bd5-aad74faba83f'
  const adminEmail = 'nkabram@gmail.com'
  
  console.log(`Checking user: ${adminEmail} (${adminUserId})`)
  
  // 1. Check profiles table
  console.log('\n1. Checking profiles table...')
  try {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', adminUserId)
    
    if (profileError) {
      console.error('❌ Error fetching profile:', profileError)
    } else if (!profileData || profileData.length === 0) {
      console.log('❌ No profile found for this user')
    } else {
      console.log('✅ Profile found:')
      console.log(JSON.stringify(profileData[0], null, 2))
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
  
  // 2. Check admins table
  console.log('\n2. Checking admins table...')
  try {
    const { data: adminData, error: adminError } = await supabase
      .from('admins')
      .select('*')
      .eq('user_id', adminUserId)
    
    if (adminError) {
      console.error('❌ Error fetching admin record:', adminError)
    } else if (!adminData || adminData.length === 0) {
      console.log('❌ No admin record found for this user')
    } else {
      console.log('✅ Admin record found:')
      console.log(JSON.stringify(adminData[0], null, 2))
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
  
  // 3. Check auth.users table
  console.log('\n3. Checking auth.users table...')
  try {
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(adminUserId)
    
    if (userError) {
      console.error('❌ Error fetching user:', userError)
    } else if (!userData) {
      console.log('❌ No user found')
    } else {
      console.log('✅ User found:')
      console.log(JSON.stringify({
        id: userData.user.id,
        email: userData.user.email,
        emailConfirmed: userData.user.email_confirmed_at,
        createdAt: userData.user.created_at,
        updatedAt: userData.user.updated_at
      }, null, 2))
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
  
  console.log('\n🎉 Check complete!')
}

checkAdminStatus().catch(console.error)
