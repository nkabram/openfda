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

export async function POST(request: NextRequest) {
  try {
    const { queryId, messageId, feedbackType, feedbackText, responseType } = await request.json()
    
    console.log('🔍 Feedback API - Received data:', {
      queryId,
      messageId,
      feedbackType,
      feedbackText: feedbackText ? 'provided' : 'empty',
      responseType
    })

    // Validate required fields
    if (!feedbackType || !['thumbs_up', 'thumbs_down'].includes(feedbackType)) {
      return NextResponse.json(
        { error: 'Invalid feedback type' },
        { status: 400 }
      )
    }

    if (!responseType || !['original', 'follow_up'].includes(responseType)) {
      return NextResponse.json(
        { error: 'Invalid response type' },
        { status: 400 }
      )
    }

    if (!queryId && !messageId) {
      return NextResponse.json(
        { error: 'Either queryId or messageId must be provided' },
        { status: 400 }
      )
    }

    // Get user from request
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    let finalQueryId = queryId

    // Verify that the query/message belongs to the user or is accessible
    if (queryId) {
      const { data: query, error: queryError } = await supabase
        .from('fda_queries')
        .select('id, user_id')
        .eq('id', queryId)
        .single()

      if (queryError || !query) {
        return NextResponse.json(
          { error: 'Query not found' },
          { status: 404 }
        )
      }

      if (query.user_id !== user.id) {
        return NextResponse.json(
          { error: 'Not authorized to provide feedback on this query' },
          { status: 403 }
        )
      }
    }

    if (messageId) {
      console.log('🔍 Feedback API - Looking for message with ID:', messageId)
      
      const { data: message, error: messageError } = await supabase
        .from('fda_messages')
        .select('id, user_id, query_id')
        .eq('id', messageId)
        .single()

      console.log('🔍 Feedback API - Message query result:', {
        message,
        error: messageError
      })

      if (messageError || !message) {
        console.error('❌ Feedback API - Message not found:', {
          messageId,
          error: messageError
        })
        return NextResponse.json(
          { error: 'Message not found' },
          { status: 404 }
        )
      }

      if (message.user_id !== user.id) {
        return NextResponse.json(
          { error: 'Not authorized to provide feedback on this message' },
          { status: 403 }
        )
      }

      // If messageId is provided but not queryId, get the queryId from the message
      if (!queryId && message.query_id) {
        finalQueryId = message.query_id
      }
    }

    // Check if feedback already exists for this user and response
    let query = supabase
      .from('response_feedback')
      .select('id')
      .eq('user_id', user.id)
      .eq('response_type', responseType)
    
    // Handle query_id - use .eq() for non-null values, .is() for null
    if (finalQueryId) {
      query = query.eq('query_id', finalQueryId)
    } else {
      query = query.is('query_id', null)
    }
    
    // Handle message_id - use .eq() for non-null values, .is() for null
    if (messageId) {
      query = query.eq('message_id', messageId)
    } else {
      query = query.is('message_id', null)
    }
    
    const { data: existingFeedback, error: checkError } = await query.single()

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error checking existing feedback:', checkError)
      return NextResponse.json(
        { error: 'Database error while checking existing feedback' },
        { status: 500 }
      )
    }

    const feedbackData = {
      user_id: user.id,
      query_id: finalQueryId || null,
      message_id: messageId || null,
      feedback_type: feedbackType,
      feedback_text: feedbackText || null,
      response_type: responseType,
    }

    let result
    if (existingFeedback) {
      // Update existing feedback
      const { data, error: updateError } = await supabase
        .from('response_feedback')
        .update(feedbackData)
        .eq('id', existingFeedback.id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating feedback:', updateError)
        return NextResponse.json(
          { error: 'Failed to update feedback' },
          { status: 500 }
        )
      }
      result = data
    } else {
      // Insert new feedback
      const { data, error: insertError } = await supabase
        .from('response_feedback')
        .insert(feedbackData)
        .select()
        .single()

      if (insertError) {
        console.error('Error inserting feedback:', insertError)
        return NextResponse.json(
          { error: 'Failed to save feedback' },
          { status: 500 }
        )
      }
      result = data
    }

    return NextResponse.json({
      success: true,
      feedback: result,
      message: existingFeedback ? 'Feedback updated successfully' : 'Feedback saved successfully'
    })

  } catch (error) {
    console.error('Error in feedback API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const queryId = searchParams.get('queryId')

    if (!queryId) {
      return NextResponse.json(
        { error: 'queryId parameter is required' },
        { status: 400 }
      )
    }

    // Get user from request
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get feedback for this query
    const { data: feedback, error } = await supabase
      .from('response_feedback')
      .select(`
        id,
        feedback_type,
        feedback_text,
        created_at,
        query_id,
        message_id
      `)
      .eq('user_id', user.id)
      .or(`query_id.eq.${queryId},message_id.in.(select id from fda_messages where query_id='${queryId}')`)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching feedback:', error)
      return NextResponse.json(
        { error: 'Failed to fetch feedback' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      feedback: feedback || []
    })

  } catch (error) {
    console.error('Error in feedback GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
