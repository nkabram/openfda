// Apply SQL function to Supabase database
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

async function applySqlFunction() {
  console.log('🔧 Applying SQL function to database...')
  
  // Read SQL file
  const sqlPath = path.join(__dirname, 'sql', 'get_admin_queries_function.sql')
  const sqlContent = fs.readFileSync(sqlPath, 'utf8')
  
  try {
    // Execute SQL using direct REST API call
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({ sql: sqlContent })
    })
    
    const result = await response.json()
    
    if (!response.ok) {
      console.error('❌ Error applying SQL function:', result)
      console.log('Status:', response.status)
      
      // Try alternative approach - split into statements
      console.log('\nTrying alternative approach - executing SQL directly...')
      
      // Direct SQL execution using the service role client
      const { error } = await supabase.from('_sql').rpc('exec_sql', {
        query_string: sqlContent
      })
      
      if (error) {
        console.error('❌ Alternative approach failed:', error)
      } else {
        console.log('✅ SQL function applied successfully using alternative approach')
      }
    } else {
      console.log('✅ SQL function applied successfully')
    }
    
    // Test the function
    console.log('\nTesting get_admin_queries function...')
    const { data: queries, error: queryError } = await supabase.rpc('get_admin_queries')
    
    if (queryError) {
      console.error('❌ Error testing function:', queryError)
    } else {
      console.log(`✅ Function returned ${queries?.length || 0} queries`)
      
      if (queries && queries.length > 0) {
        const sampleQuery = queries[0]
        console.log('Sample query:', {
          id: sampleQuery.id,
          user_id: sampleQuery.user_id,
          user_email: sampleQuery.user_email || 'No email',
          user_name: sampleQuery.user_name || 'No name'
        })
      }
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

applySqlFunction().catch(console.error)
