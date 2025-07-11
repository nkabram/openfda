// Quick test to check database contents
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function testDatabase() {
  console.log('Testing database...')
  
  // Check queries
  const { data: queries, error: queriesError } = await supabase
    .from('fda_queries')
    .select('id, user_id, user_query, created_at')
    .order('created_at', { ascending: false })
    .limit(5)
  
  console.log('Queries:', { count: queries?.length || 0, error: queriesError })
  if (queries) {
    queries.forEach(q => console.log(`Query ${q.id}: user_id=${q.user_id}, query="${q.user_query?.substring(0, 50)}..."`))
  }
  
  // Check users
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email, is_approved')
    .limit(5)
  
  console.log('Profiles:', { count: profiles?.length || 0, error: profilesError })
  if (profiles) {
    profiles.forEach(p => console.log(`Profile ${p.id}: email=${p.email}, approved=${p.is_approved}`))
  }
  
  // Check admins
  const { data: admins, error: adminsError } = await supabase
    .from('admins')
    .select('user_id, is_admin')
  
  console.log('Admins:', { count: admins?.length || 0, error: adminsError })
  if (admins) {
    admins.forEach(a => console.log(`Admin: user_id=${a.user_id}, is_admin=${a.is_admin}`))
  }
}

testDatabase().catch(console.error)
