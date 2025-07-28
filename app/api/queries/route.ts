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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const viewType = searchParams.get('view') // 'admin' or 'user'
    
    // Get user from request
    const user = await getUserFromRequest(request)
    if (!user) {

      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    


    if (viewType === 'admin') {

      // Then check if user is admin - don't use single() to avoid errors
      const { data: adminData } = await supabase
        .from('admins')
        .select('is_admin')
        .eq('user_id', user.id)
        .eq('is_admin', true)
      
      // If no admin records found, user is not admin
      if (!adminData || adminData.length === 0) {
        return NextResponse.json(
          { error: 'Forbidden - Admin access required' },
          { status: 403 }
        )
      }

      // User is admin, fetch all queries
      const { data: queries, error: queriesError } = await supabase
        .from('fda_queries')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (queriesError) {
        console.error('Error fetching admin queries:', queriesError)
        return NextResponse.json(
          { error: 'Error fetching queries' },
          { status: 500 }
        )
      }

      // Fetch user profiles separately to avoid join issues
      const userIds = Array.from(new Set(queries?.map(q => q.user_id).filter(Boolean))) as string[]
      
      let profilesMap: Record<string, any> = {}
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', userIds)
        
        if (!profilesError && profiles) {
          profilesMap = profiles.reduce((acc, profile) => {
            acc[profile.id] = profile
            return acc
          }, {} as Record<string, any>)
        }
      }
      
      // Combine queries with user info
      const queriesWithUserInfo = queries?.map(query => ({
        ...query,
        profiles: profilesMap[query.user_id] || null,
        user_email: profilesMap[query.user_id]?.email || 'Unknown',
        user_name: profilesMap[query.user_id]?.full_name || 'Unknown User'
      })) || []


      return NextResponse.json({ queries: queriesWithUserInfo })
    } else {
      // Regular user view - get only user's own queries

      const { data, error } = await supabase
        .from('fda_queries')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('Error fetching user queries:', error)
        return NextResponse.json(
          { error: 'Failed to fetch queries' },
          { status: 500 }
        )
      }


      return NextResponse.json({ queries: data || [] })
    }
  } catch (error) {
    console.error('Error in queries GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userQuery, extractedMedication, openfdaResponse, aiResponse } = await request.json()

    if (!userQuery || !aiResponse) {
      return NextResponse.json(
        { error: 'userQuery and aiResponse are required' },
        { status: 400 }
      )
    }

    // Get user from request
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Use service role client to insert the query with user_id
    const { data, error } = await supabase
      .from('fda_queries')
      .insert([
        {
          user_id: user.id,
          user_query: userQuery,
          medication_name: extractedMedication,
          fda_response: openfdaResponse,
          ai_response: aiResponse,
        }
      ])
      .select()

    if (error) {
      console.error('Error saving query:', error)
      return NextResponse.json(
        { error: 'Failed to save query' },
        { status: 500 }
      )
    }

    return NextResponse.json({ query: data[0] })
  } catch (error) {
    console.error('Error in queries POST:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const queryId = searchParams.get('id')

    if (!queryId) {
      return NextResponse.json(
        { error: 'Query ID is required' },
        { status: 400 }
      )
    }

    // Always require authentication
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { error } = await supabase
      .from('fda_queries')
      .delete()
      .match({ id: queryId, user_id: user.id })

    if (error) {
      console.error('Error deleting query:', error)
      return NextResponse.json(
        { error: 'Failed to delete query' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in queries DELETE:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
