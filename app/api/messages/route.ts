import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isLocalhost } from '@/lib/utils'

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
    const queryId = searchParams.get('queryId')

    if (!queryId) {
      return NextResponse.json(
        { error: 'Query ID is required' },
        { status: 400 }
      )
    }

    let userId = null

    // For localhost development, user_id can be null
    if (!isLocalhost()) {
      const user = await getUserFromRequest(request)
      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
      userId = user.id

      // Verify user has access to this query
      const { data: query, error: queryError } = await supabase
        .from('fda_queries')
        .select('id')
        .eq('id', queryId)
        .eq('user_id', userId)
        .single()

      if (queryError || !query) {
        return NextResponse.json(
          { error: 'Query not found or access denied' },
          { status: 404 }
        )
      }
    }

    const { data, error } = await supabase
      .from('fda_messages')
      .select('*')
      .eq('query_id', queryId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching messages:', error)
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      )
    }

    return NextResponse.json({ messages: data || [] })
  } catch (error) {
    console.error('Error in messages GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
