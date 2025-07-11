// Test the API endpoints directly
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
const fetch = require('node-fetch')

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

async function testApi() {
  console.log('🧪 Testing API endpoints...\n')
  
  // Get admin user token for authentication
  const adminUserId = '69cd1ba7-761b-4e3e-8bd5-aad74faba83f'
  const adminEmail = 'nkabram@gmail.com'
  
  console.log('1. Getting admin user token...')
  let adminToken = null
  
  try {
    // Create a JWT token for the admin user
    const { data: { session }, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: adminEmail,
      options: {
        redirectTo: 'http://localhost:3000'
      }
    })
    
    if (error) {
      console.error('❌ Error generating admin token:', error)
    } else if (session) {
      adminToken = session.access_token
      console.log('✅ Admin token generated')
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
  
  if (!adminToken) {
    console.log('⚠️ Could not get admin token, using service role key instead')
    adminToken = supabaseKey
  }
  
  // Test admin queries endpoint
  console.log('\n2. Testing admin queries endpoint...')
  try {
    const response = await fetch('http://localhost:3000/api/queries?view=admin', {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    })
    
    if (!response.ok) {
      console.error('❌ Admin queries API error:', response.status, response.statusText)
      const errorText = await response.text()
      console.error('Error details:', errorText)
    } else {
      const data = await response.json()
      console.log(`✅ Admin queries API returned ${data.queries?.length || 0} queries`)
      
      // Check if user info is included
      if (data.queries && data.queries.length > 0) {
        const sampleQuery = data.queries[0]
        console.log('Sample query:', {
          id: sampleQuery.id,
          user_id: sampleQuery.user_id,
          user_email: sampleQuery.user_email || 'No email',
          user_name: sampleQuery.user_name || 'No name'
        })
        
        const hasUserInfo = data.queries.some(q => q.user_email || q.user_name)
        console.log(`✅ User info included: ${hasUserInfo ? 'YES' : 'NO'} (should be YES)`)
      }
    }
  } catch (error) {
    console.error('❌ Error testing admin queries API:', error)
  }
  
  console.log('\n🎉 API testing complete!')
}

testApi().catch(console.error)
