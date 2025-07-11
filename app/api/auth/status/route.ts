import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Force this route to be dynamic (not statically generated)
export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function GET(request: Request) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No authorization token' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Verify the token and get user
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      console.error('Auth error:', authError)
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    console.log('🔍 Checking status for user:', user.email)

    // Check profile approval status
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('is_approved')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Profile error:', profileError)
      return NextResponse.json({ 
        isApproved: false, 
        isAdmin: false,
        error: 'Profile not found' 
      })
    }

    // Check admin status
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('admins')
      .select('is_admin')
      .eq('user_id', user.id)
      .eq('is_admin', true)

    console.log('📊 Status check results:', {
      userId: user.id,
      email: user.email,
      profileApproved: profileData?.is_approved,
      adminRecords: adminData?.length || 0
    })

    const isAdmin = adminData && adminData.length > 0
    const isApproved = isAdmin || profileData?.is_approved || false

    return NextResponse.json({
      isApproved,
      isAdmin,
      email: user.email,
      userId: user.id
    })

  } catch (error) {
    console.error('Status check error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
