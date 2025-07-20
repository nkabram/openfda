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

interface SmartFollowUpRequest {
  query: string
  queryId: string
  forceIntent?: 'web_search'
}

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

// Function to try answering from saved FDA data
async function tryAnswerFromSavedData(query: string, originalQuery: any, previousMessages: any[]) {
  const conversationHistory = previousMessages?.map(m => 
    `${m.message_type === 'question' ? 'User' : 'Assistant'}: ${m.content}`
  ).join('\n') || ''

  // Check if we have saved FDA data
  const fdaData = originalQuery.fda_raw_data
  const fdaSections = originalQuery.fda_sections_used || []
  
  if (!fdaData || Object.keys(fdaData).length === 0) {
    return { canAnswer: false, content: '', citations: [] }
  }

  // Try to answer using saved FDA data
  const systemPrompt = `You are a helpful medical information assistant. The user is asking a follow-up question about a previous medication query.

Original Query: "${originalQuery.user_query}"
Medication: ${originalQuery.medication_name || 'Not specified'}
Previous Response: "${originalQuery.ai_response}"

${conversationHistory ? `Previous Conversation:\n${conversationHistory}` : ''}

Available FDA Data Sections:
${Object.entries(fdaData).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n')}

Please answer the user's follow-up question using ONLY the FDA data provided above. If you cannot answer the question with the available FDA data, respond with "INSUFFICIENT_DATA".

IMPORTANT: Format your response with a "Bottom line:" summary at the end. Always include appropriate medical disclaimers.

Example format:
[Detailed explanation here]

Bottom line: [One sentence summary of the key point]`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query }
      ],
      temperature: 0.7,
      max_tokens: 800,
    })

    const response = completion.choices[0]?.message?.content || ''
    
    if (response.includes('INSUFFICIENT_DATA')) {
      return { canAnswer: false, content: '', citations: [] }
    }

    // Create citations from the FDA sections used
    const citations = fdaSections.map((section: string, index: number) => ({
      id: index + 1,
      title: `FDA ${section.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
      url: `https://www.fda.gov/drugs/drug-approvals-and-databases/approved-drug-products-therapeutic-equivalence-evaluations-orange-book`,
      snippet: `Information from FDA ${section} section for ${originalQuery.medication_name}`
    }))

    return { canAnswer: true, content: response, citations }
  } catch (error) {
    console.error('Error answering from saved data:', error)
    return { canAnswer: false, content: '', citations: [] }
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Smart follow-up API called')
    
    // Get the auth token for passing to other endpoints
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const authToken = authHeader.replace('Bearer ', '')
    
    // Get the authenticated user
    const user = await getUserFromRequest(request)
    console.log('👤 User from request:', user?.id)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: SmartFollowUpRequest = await request.json()
    console.log('📝 Request body:', body)
    const { query, queryId, forceIntent } = body

    if (!query?.trim() || !queryId) {
      console.log('❌ Missing query or queryId')
      return NextResponse.json(
        { error: 'Query and queryId are required' },
        { status: 400 }
      )
    }

    // Get the original query and conversation context
    console.log('🔍 Looking for query:', queryId, 'for user:', user.id)
    const { data: originalQuery, error: queryError } = await supabase
      .from('fda_queries')
      .select('*')
      .eq('id', queryId)
      .eq('user_id', user.id)
      .single()

    console.log('📊 Query result:', { originalQuery: !!originalQuery, queryError })
    if (queryError || !originalQuery) {
      console.log('❌ Query not found or error:', queryError)
      return NextResponse.json(
        { error: 'Query not found or unauthorized' },
        { status: 404 }
      )
    }

    // Get previous messages for context
    const { data: previousMessages } = await supabase
      .from('fda_messages')
      .select('*')
      .eq('query_id', queryId)
      .order('created_at', { ascending: true })

    // Step 1: Detect intent - web search vs FDA-related
    let isWebSearchIntent = false
    
    // Check if user explicitly wants web search
    if (forceIntent === 'web_search') {
      isWebSearchIntent = true
      console.log('🔍 Forced web search intent')
    } else {
      // Detect intent using keywords
      const queryLower = query.toLowerCase()
      
      // Web search keywords - current research, studies, news
      const webSearchKeywords = [
        'studies', 'research', 'latest', 'recent', 'current', 'new',
        'clinical trials', 'trials', 'evidence', 'findings', 'data',
        'published', 'literature', 'papers', 'articles', 'news',
        'updates', 'developments', 'breakthrough', 'discovery',
        'compare', 'comparison', 'versus', 'vs', 'alternative',
        'review', 'meta-analysis', 'systematic review'
      ]
      
      isWebSearchIntent = webSearchKeywords.some(keyword => 
        queryLower.includes(keyword)
      )
      
      if (isWebSearchIntent) {
        console.log('🔍 Detected web search keywords')
      } else {
        console.log('🏥 Detected FDA-related query')
      }
    }

    // Step 2: Note: Questions and answers are saved by the respective APIs (websearch/FDA search)
    // No need to save here to avoid duplication
    const followUpMode = isWebSearchIntent ? 'websearch' : 'llm_only'

    let responseContent = ''
    let citations: any[] = []
    let websearchUsed = false

    // Step 3: Handle the query based on intent
    if (isWebSearchIntent) {
      // Web search intent - use web search directly
      console.log('🌐 Processing web search request')
      try {
        const webSearchResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/follow-up-websearch`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            followUpQuestion: query,
            queryId: originalQuery.id,
            medication: originalQuery.medication_name,
            previousResponse: originalQuery.ai_response
          })
        })

        if (webSearchResponse.ok) {
          const result = await webSearchResponse.json()
          responseContent = result.response || 'No web search results found.'
          citations = result.citations || []
          websearchUsed = true
        } else {
          responseContent = 'I apologize, but I was unable to perform a web search at this time. Please try again later.'
          citations = []
          websearchUsed = false
        }
      } catch (error) {
        console.error('❌ Web search error:', error)
        responseContent = 'I apologize, but I encountered an error while searching the web. Please try again later.'
        citations = []
        websearchUsed = false
      }
    } else {
      // FDA-related intent - try saved data first, then new search if needed
      console.log('🏥 Processing FDA-related request')
      
      // First try to answer from saved FDA data
      const savedDataResponse = await tryAnswerFromSavedData(query, originalQuery, previousMessages || [])
      
      if (savedDataResponse.canAnswer) {
        console.log('✅ Answered from saved FDA data')
        responseContent = savedDataResponse.content
        citations = savedDataResponse.citations || []
        websearchUsed = false
      } else {
        console.log('❌ Cannot answer from saved data, performing new FDA search')
        // Need new FDA search - use the existing FDA search endpoint
        try {
          const fdaSearchResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/follow-up-fda`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
              followUpQuestion: query,
              queryId: originalQuery.id,
              mode: 'fda_docs'
            })
          })

          if (fdaSearchResponse.ok) {
            const result = await fdaSearchResponse.json()
            responseContent = result.response || 'No FDA search results found.'
            citations = result.citations || []
            websearchUsed = false
          } else {
            responseContent = 'I apologize, but I was unable to perform an FDA search at this time. Please try again later.'
            citations = []
            websearchUsed = false
          }
        } catch (error) {
          console.error('❌ FDA search error:', error)
          responseContent = 'I apologize, but I encountered an error while searching the FDA database. Please try again later.'
          citations = []
          websearchUsed = false
        }
      }
    }

    // Return success response (messages are saved by the respective APIs)
    return NextResponse.json({
      success: true,
      intent: isWebSearchIntent ? 'web_search' : 'fda_search',
      response: responseContent,
      citations,
      websearchUsed
    })

  } catch (error) {
    console.error('🔥 Smart follow-up error:', error)
    console.error('🔥 Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('🔥 Error message:', error instanceof Error ? error.message : String(error))
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
