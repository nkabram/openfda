import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { isLocalhost } from '@/lib/utils'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl!, supabaseKey!)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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
    const { queryId, followUpQuestion } = await request.json()

    if (!queryId || !followUpQuestion) {
      return NextResponse.json(
        { error: 'Query ID and follow-up question are required' },
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

    // Get the original query and verify user access
    const queryFilter = userId ? { id: queryId, user_id: userId } : { id: queryId }
    const { data: originalQuery, error: queryError } = await supabase
      .from('fda_queries')
      .select('*')
      .match(queryFilter)
      .single()

    if (queryError) {
      return NextResponse.json(
        { error: 'Failed to fetch original query or access denied' },
        { status: 500 }
      )
    }

    // Get all previous messages for this query
    const { data: messages, error: messagesError } = await supabase
      .from('fda_messages')
      .select('*')
      .eq('query_id', queryId)
      .order('created_at', { ascending: true })

    if (messagesError) {
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      )
    }

    // Build conversation context
    let conversationContext = `Original Question: ${originalQuery.user_query}\n`
    conversationContext += `Original Answer: ${originalQuery.ai_response}\n\n`

    if (messages && messages.length > 0) {
      conversationContext += 'Previous Follow-up Conversation:\n'
      messages.forEach((msg, index) => {
        if (msg.message_type === 'question') {
          conversationContext += `Follow-up Question ${Math.floor(index / 2) + 1}: ${msg.content}\n`
        } else if (msg.message_type === 'answer') {
          conversationContext += `Follow-up Answer ${Math.floor(index / 2) + 1}: ${msg.content}\n`
        }
      })
      conversationContext += '\n'
    }

    // Save the follow-up question to messages table
    const { error: saveQuestionError } = await supabase
      .from('fda_messages')
      .insert([
        {
          query_id: queryId,
          user_id: userId,
          message_type: 'question',
          content: followUpQuestion,
        }
      ])

    if (saveQuestionError) {
      console.error('Error saving follow-up question:', saveQuestionError)
    }

    // Generate AI response for follow-up
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-nano',
      messages: [
        {
          role: 'system',
          content: `You are a knowledgeable medication information assistant providing follow-up responses to medication-related questions.

Context: You are responding to a follow-up question in an ongoing conversation about medication. The user has already received initial information and is asking for clarification or additional details.

Guidelines:
1. Reference the previous conversation context when relevant
2. Provide clear, focused answers to the specific follow-up question
3. Maintain consistency with previous responses
4. If the follow-up question is unrelated to the original medication topic, gently redirect while still being helpful
5. Keep responses concise but informative

RESPONSE FORMAT:
Start your response with "**Bottom Line:** [One sentence summary that directly answers the follow-up question]"

Then provide the detailed explanation below.`
        },
        {
          role: 'user',
          content: `${conversationContext}New Follow-up Question: ${followUpQuestion}

Please provide a helpful response to this follow-up question, taking into account the previous conversation context.`
        }
      ],
      temperature: 0.3,
      max_tokens: 800,
    })

    const response = completion.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response to your follow-up question.'

    // Save the AI response to messages table
    const { error: saveAnswerError } = await supabase
      .from('fda_messages')
      .insert([
        {
          query_id: queryId,
          user_id: userId,
          message_type: 'answer',
          content: response,
        }
      ])

    if (saveAnswerError) {
      console.error('Error saving follow-up answer:', saveAnswerError)
    }

    return NextResponse.json({
      response,
      queryId
    })
  } catch (error) {
    console.error('Error generating follow-up response:', error)
    return NextResponse.json(
      { error: 'Failed to generate follow-up response' },
      { status: 500 }
    )
  }
}
