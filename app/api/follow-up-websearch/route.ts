import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

// Force this route to be dynamic (not statically generated)
export const dynamic = 'force-dynamic'

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

    // Always get user from request for proper authentication
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    userId = user.id

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
          websearch_enabled: false, // Questions don't use websearch
        }
      ])

    if (saveQuestionError) {
      console.error('Error saving follow-up question:', saveQuestionError)
    }

    // Generate AI response for follow-up with OpenAI web search using Responses API
    const completion = await openai.responses.create({
      model: 'gpt-4.1-mini',
      tools: [{ type: 'web_search_preview' }],
      input: `You are a knowledgeable medication information assistant providing follow-up responses to medication-related questions.

Context: You are responding to a follow-up question in an ongoing conversation about medication. The user has already received initial information and is asking for clarification or additional details. You have access to web search to find the most current and comprehensive information.

Previous conversation context:
${conversationContext}

New Follow-up Question: ${followUpQuestion}

Guidelines:
1. Use web search to find current, authoritative information to answer the follow-up question
2. Reference the previous conversation context when relevant
3. Provide clear, focused answers to the specific follow-up question
4. Maintain consistency with previous responses while incorporating new web search findings
5. If the follow-up question is unrelated to the original medication topic, gently redirect while still being helpful
6. Prioritize medical and scientific sources in your web searches
7. Always cite your sources when providing information from web search

RESPONSE FORMAT:
Start your response with "**Bottom Line:** [One sentence summary that directly answers the follow-up question]"

Then provide the detailed explanation below, incorporating information from web search results and citing sources appropriately.

Please provide a helpful response to this follow-up question, taking into account the previous conversation context. Use web search to find current, authoritative information to supplement your response.`
    })

    let rawResponse = completion.output_text || 'I apologize, but I was unable to generate a response.'
    
    // Extract citations from the OpenAI response
    let citations: any[] = []
    let formattedResponse = rawResponse
    
    // Parse URLs from the response and extract them as citations
    const urlRegex = /\[([^\]]+)\]\(([^)]+)\)/g
    const urlMatches = Array.from(rawResponse.matchAll(urlRegex))
    
    if (urlMatches.length > 0) {
      citations = urlMatches.map((match, index) => {
        const linkText = match[1]
        const url = match[2].replace('?utm_source=openai', '') // Clean up OpenAI tracking
        const domain = new URL(url).hostname
        
        return {
          title: linkText || domain,
          url: url,
          snippet: `Source from ${domain}`,
          display_url: domain,
          position: index + 1
        }
      })
      
      // Remove any sources section from the AI-generated response to avoid duplication
      // since we display citations separately with blue formatting
      formattedResponse = formattedResponse.replace(/\n\n---\n\n\*\*Sources?:\*\*[\s\S]*$/i, '')
      formattedResponse = formattedResponse.replace(/\n\n\*\*References?:\*\*[\s\S]*$/i, '')
      formattedResponse = formattedResponse.replace(/\n\n\*\*Citations?:\*\*[\s\S]*$/i, '')
    }
    
    const response = formattedResponse

    // Save the follow-up answer to messages table with citations
    const { error: saveAnswerError } = await supabase
      .from('fda_messages')
      .insert([
        {
          query_id: queryId,
          user_id: userId,
          message_type: 'answer',
          content: response,
          websearch_enabled: true,
          citations: citations.length > 0 ? citations : null,
        }
      ])

    if (saveAnswerError) {
      console.error('Error saving follow-up answer:', saveAnswerError)
    }

    return NextResponse.json({
      response,
      citations,
      queryId,
      websearchUsed: citations.length > 0
    })
  } catch (error) {
    console.error('Error generating follow-up response with websearch:', error)
    return NextResponse.json(
      { error: 'Failed to generate follow-up response' },
      { status: 500 }
    )
  }
}
