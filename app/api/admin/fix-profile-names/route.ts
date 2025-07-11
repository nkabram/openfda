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
    const { data: profileData } = await supabase
      .from('profiles')
      .select('is_approved')
      .eq('id', userId)
      .single()

    if (!profileData?.is_approved) return false

    const { data: adminData } = await supabase
      .from('admins')
      .select('is_admin')
      .eq('user_id', userId)
      .eq('is_admin', true)

    return adminData && adminData.length > 0
  } catch (error) {
    console.error('Error checking admin status:', error)
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = await isUserAdmin(user.id)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    // Get all auth users with their metadata
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()
    
    if (authError) {
      console.error('Error fetching auth users:', authError)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    let updatedCount = 0
    const updates = []

    // Check each user and update profiles where needed
    for (const authUser of authUsers.users) {
      const fullName = authUser.user_metadata?.full_name || 
                      authUser.raw_user_meta_data?.full_name ||
                      null

      if (fullName) {
        // Check if profile needs update
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('id', authUser.id)
          .single()

        if (profile && !profile.full_name) {
          // Update the profile
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ full_name: fullName })
            .eq('id', authUser.id)

          if (!updateError) {
            updatedCount++
            updates.push({
              id: authUser.id,
              email: authUser.email,
              full_name: fullName
            })
          }
        }
      }
    }

    return NextResponse.json({
      message: `Updated ${updatedCount} profiles with missing full names`,
      updates
    })

  } catch (error) {
    console.error('Error in fix-profile-names:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
