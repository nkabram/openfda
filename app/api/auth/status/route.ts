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
    console.log('🔑 Auth header received:', authHeader ? 'Bearer [REDACTED]' : 'No header')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No valid authorization header')
      return NextResponse.json({ error: 'No authorization token' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    console.log('🎫 Token length:', token.length, 'First 10 chars:', token.substring(0, 10))
    
    // Verify the token and get user
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      console.error('🔥 Auth token validation failed:', {
        error: authError?.message || 'Unknown error',
        code: authError?.status || 'No status',
        name: authError?.name || 'No error name',
        hasUser: !!user,
        tokenLength: token.length,
        tokenStart: token.substring(0, 20) + '...'
      })
      
      // Provide specific error message based on error type
      let errorMessage = 'Session expired - please sign out and sign back in'
      let needsReauth = true
      
      if (authError?.message?.includes('Auth session missing') || 
          authError?.message?.includes('invalid') ||
          authError?.message?.includes('expired') ||
          authError?.message?.includes('JWT')) {
        errorMessage = 'Session expired - please sign out and sign back in'
        needsReauth = true
      } else if (authError?.message?.includes('network') || 
                 authError?.message?.includes('timeout')) {
        errorMessage = 'Network error - please try again'
        needsReauth = false
      }
      
      return NextResponse.json({ 
        error: errorMessage, 
        details: authError?.message,
        needsReauth,
        shouldSignOut: needsReauth
      }, { status: 401 })
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
      adminRecords: adminData?.length || 0
    })

    const isAdmin = adminData && adminData.length > 0

    return NextResponse.json({
      isAdmin,
      email: user.email,
      userId: user.id
    })

  } catch (error) {
    console.error('Status check error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
