import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl!, supabaseKey!)

// Helper function to get user from request
async function getUserFromRequest(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return null

    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(token)
    return user
  } catch (error) {
    console.error('Error getting user:', error)
    return null
  }
}

// Helper function to check if user is admin
async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    // First check if user is approved
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('is_approved')
      .eq('id', userId)
      .single()

    if (profileError || !profileData?.is_approved) {
      return false
    }

    // Then check if user is admin - don't use single() to avoid errors
    const { data: adminData } = await supabase
      .from('admins')
      .select('is_admin')
      .eq('user_id', userId)
      .eq('is_admin', true)

    // If we found any matching admin records, user is admin
    return Boolean(adminData && adminData.length > 0)
  } catch (error) {
    console.error('Error checking admin status:', error)
    return false
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const isAdmin = await isUserAdmin(user.id)
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    // Fetch pending users
    const { data: pendingUsers, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, created_at')
      .eq('is_approved', false)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching pending users:', error)
      return NextResponse.json(
        { error: 'Failed to fetch pending users' },
        { status: 500 }
      )
    }

    return NextResponse.json({ users: pendingUsers })
  } catch (error) {
    console.error('Error in pending users API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const isAdmin = await isUserAdmin(user.id)
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const { userId, action } = await request.json()

    if (!userId || !action) {
      return NextResponse.json(
        { error: 'User ID and action are required' },
        { status: 400 }
      )
    }

    if (action === 'approve') {
      const { error } = await supabase
        .from('profiles')
        .update({ is_approved: true })
        .eq('id', userId)

      if (error) {
        console.error('Error approving user:', error)
        return NextResponse.json(
          { error: 'Failed to approve user' },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true, message: 'User approved successfully' })
    } else if (action === 'reject') {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId)

      if (error) {
        console.error('Error rejecting user:', error)
        return NextResponse.json(
          { error: 'Failed to reject user' },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true, message: 'User rejected successfully' })
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "approve" or "reject"' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Error in pending users POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
