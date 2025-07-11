import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Force this route to be dynamic (not statically generated)
export const dynamic = 'force-dynamic'

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
  const { data, error } = await supabase
    .from('admins')
    .select('is_admin')
    .eq('user_id', userId)
    .single()

  return !error && data?.is_admin === true
}

// GET: Get current auto-approve domains
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
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

    // Return the current trusted domains
    const trustedDomains = [
      '*.ah.org',
      'umich.edu'
    ]

    return NextResponse.json({
      domains: trustedDomains,
      message: 'Users with email addresses from these domains are automatically approved upon registration'
    })

  } catch (error) {
    console.error('Error fetching auto-approve domains:', error)
    return NextResponse.json(
      { error: 'Failed to fetch auto-approve domains' },
      { status: 500 }
    )
  }
}

// POST: Apply auto-approval to existing users
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
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

    // Apply auto-approval to existing users with trusted domains or in email whitelist
    const { data, error } = await supabase.rpc('apply_auto_approval_to_existing_users')

    if (error) {
      console.error('Error applying auto-approval:', error)
      return NextResponse.json(
        { error: 'Failed to apply auto-approval' },
        { status: 500 }
      )
    }

    // Count the number of users that were approved
    const approvedCount = data ? data.length : 0
    const approvedEmails = data ? data.map((u: any) => u.email).join(', ') : ''

    return NextResponse.json({
      success: true,
      message: approvedCount > 0 
        ? `Auto-approval applied successfully. ${approvedCount} user(s) were approved: ${approvedEmails}`
        : 'No users found matching the auto-approval criteria.',
      approvedCount,
      approvedUsers: data || []
    })

  } catch (error) {
    console.error('Error applying auto-approval:', error)
    return NextResponse.json(
      { error: 'Failed to apply auto-approval' },
      { status: 500 }
    )
  }
}
