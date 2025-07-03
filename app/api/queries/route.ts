import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isLocalhost } from '@/lib/utils'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables:', {
    url: !!supabaseUrl,
    key: !!supabaseKey
  })
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
    // For localhost development, return all queries
    if (isLocalhost()) {
      const { data, error } = await supabase
        .from('fda_queries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('Error fetching queries:', error)
        return NextResponse.json(
          { error: 'Failed to fetch queries' },
          { status: 500 }
        )
      }

      return NextResponse.json({ queries: data || [] })
    }

    // For production, get user and return only their queries
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data, error } = await supabase
      .from('fda_queries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching queries:', error)
      return NextResponse.json(
        { error: 'Failed to fetch queries' },
        { status: 500 }
      )
    }

    return NextResponse.json({ queries: data || [] })
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
    }

    const { data, error } = await supabase
      .from('fda_queries')
      .insert([
        {
          user_id: userId,
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
    }

    // Build the filter based on environment
    const deleteFilter = userId ? { id: queryId, user_id: userId } : { id: queryId }

    const { error } = await supabase
      .from('fda_queries')
      .delete()
      .match(deleteFilter)

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
