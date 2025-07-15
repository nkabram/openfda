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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const queryId = params.id

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

    // First check if the query exists and belongs to the user
    const { data: existingQuery, error: fetchError } = await supabase
      .from('fda_queries')
      .select('id, user_id')
      .eq('id', queryId)
      .single()

    if (fetchError || !existingQuery) {
      console.error('Query not found:', queryId, fetchError)
      return NextResponse.json(
        { error: 'Query not found' },
        { status: 404 }
      )
    }

    // Check if user owns the query
    if (existingQuery.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden - You can only delete your own queries' },
        { status: 403 }
      )
    }

    // Delete the query
    const { error: deleteError } = await supabase
      .from('fda_queries')
      .delete()
      .eq('id', queryId)

    if (deleteError) {
      console.error('Error deleting query:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete query' },
        { status: 500 }
      )
    }

    console.log(`Successfully deleted query ${queryId} for user ${user.id}`)
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Error in query DELETE:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
