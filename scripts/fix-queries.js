// Fix queries with null user_id by assigning them to the admin user
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

async function fixQueries() {
  console.log('🔧 Fixing queries with null user_id...')
  
  // Admin user ID from the test results
  const adminUserId = '69cd1ba7-761b-4e3e-8bd5-aad74faba83f'
  
  // Update all queries with null user_id to belong to admin
  const { data, error } = await supabase
    .from('fda_queries')
    .update({ user_id: adminUserId })
    .is('user_id', null)
    .select('id')
  
  if (error) {
    console.error('❌ Error updating queries:', error)
    return
  }
  
  console.log(`✅ Updated ${data?.length || 0} queries to belong to admin user`)
  
  // Verify the update
  const { data: verifyData, error: verifyError } = await supabase
    .from('fda_queries')
    .select('id, user_id')
    .is('user_id', null)
  
  if (verifyError) {
    console.error('❌ Error verifying:', verifyError)
    return
  }
  
  console.log(`✅ Remaining queries with null user_id: ${verifyData?.length || 0}`)
}

fixQueries().catch(console.error)
