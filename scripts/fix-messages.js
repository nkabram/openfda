// Fix messages with null user_id
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

async function fixMessages() {
  console.log('🔧 Checking messages with null user_id...')
  
  // Check messages
  const { data: messages, error: messagesError } = await supabase
    .from('fda_messages')
    .select('id, user_id, query_id')
    .is('user_id', null)
  
  if (messagesError) {
    console.error('❌ Error checking messages:', messagesError)
    return
  }
  
  console.log(`Found ${messages?.length || 0} messages with null user_id`)
  
  if (messages && messages.length > 0) {
    // Admin user ID
    const adminUserId = '69cd1ba7-761b-4e3e-8bd5-aad74faba83f'
    
    // Update messages
    const { data, error } = await supabase
      .from('fda_messages')
      .update({ user_id: adminUserId })
      .is('user_id', null)
      .select('id')
    
    if (error) {
      console.error('❌ Error updating messages:', error)
      return
    }
    
    console.log(`✅ Updated ${data?.length || 0} messages to belong to admin user`)
  }
}

fixMessages().catch(console.error)
