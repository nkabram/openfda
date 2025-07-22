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
    console.log('🔑 Messages API - Auth header received:', authHeader ? 'Bearer [REDACTED]' : 'None')
    if (!authHeader) {
      console.log('❌ Messages API - No auth header provided')
      return null
    }

    const token = authHeader.replace('Bearer ', '')
    console.log('🎫 Messages API - Token length:', token.length, 'First 10 chars:', token.substring(0, 10))
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error) {
      console.log('❌ Messages API - Auth error:', error.message)
      return null
    }
    
    if (user) {
      console.log('✅ Messages API - User authenticated:', user.email)
    } else {
      console.log('❌ Messages API - No user found for token')
    }
    
    return user
  } catch (error) {
    console.error('❌ Messages API - Error getting user:', error)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('💬 Messages API called')
    const { searchParams } = new URL(request.url)
    const queryId = searchParams.get('queryId')
    console.log('💬 Requested queryId:', queryId)

    if (!queryId) {
      console.log('❌ Messages API - No queryId provided')
      return NextResponse.json(
        { error: 'Query ID is required' },
        { status: 400 }
      )
    }

    let userId = null

    // Always get user from request for proper authentication
    console.log('🔍 Messages API - Getting user from request...')
    const user = await getUserFromRequest(request)
    if (!user) {
      console.log('❌ Messages API - User authentication failed')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    userId = user.id
    console.log('✅ Messages API - User authenticated, userId:', userId)

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
