import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { getBaseUrl } from '@/lib/url-utils'

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
async function tryAnswerFromSavedData(
  query: string,
  originalQuery: any,
  previousMessages: any[]
): Promise<{ canAnswer: boolean; content: string; citations: any[] }> {
  try {
    console.log('🤖 Attempting to answer from saved FDA data')
    
    // Build conversation context
    let conversationContext = `Original Question: ${originalQuery.user_query}\n`
    conversationContext += `Original Answer: ${originalQuery.ai_response}\n\n`

    if (previousMessages && previousMessages.length > 0) {
      conversationContext += 'Previous Follow-up Conversation:\n'
      previousMessages.forEach((msg, index) => {
        if (msg.message_type === 'question') {
          conversationContext += `Follow-up Question ${Math.floor(index / 2) + 1}: ${msg.content}\n`
        } else if (msg.message_type === 'answer') {
          conversationContext += `Follow-up Answer ${Math.floor(index / 2) + 1}: ${msg.content}\n`
        }
      })
      conversationContext += '\n'
    }

    // Get FDA sections that were used in the original query
    const fdaSections = originalQuery.fda_sections_used || []
    
    // Format the FDA data for context
    let fdaContext = ''
    if (originalQuery.fda_raw_data && fdaSections.length > 0) {
      fdaContext = 'Available FDA Information:\n'
      fdaSections.forEach((section: string) => {
        if (originalQuery.fda_raw_data[section]) {
          fdaContext += `\n${section.toUpperCase().replace(/_/g, ' ')}:\n`
          const sectionData = originalQuery.fda_raw_data[section]
          if (Array.isArray(sectionData)) {
            sectionData.forEach((item: any) => {
              if (typeof item === 'string') {
                fdaContext += `- ${item}\n`
              } else if (typeof item === 'object' && item !== null) {
                Object.entries(item).forEach(([key, value]) => {
                  fdaContext += `- ${key}: ${value}\n`
                })
              }
            })
          } else if (typeof sectionData === 'string') {
            fdaContext += `- ${sectionData}\n`
          }
        }
      })
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a medication information assistant. You have access to saved FDA data and need to determine if you can answer a follow-up question using only that data.

IMPORTANT: You must respond with a JSON object in this exact format:
{
  "canAnswer": true/false,
  "response": "your answer here or empty string if cannot answer"
}

Rules:
1. Set canAnswer to true ONLY if you can provide a complete, accurate answer using the available FDA data
2. Set canAnswer to false if:
   - The question asks about a different medication than what's in the FDA data
   - The required information is not present in the FDA data
   - You need additional information to answer properly
3. If canAnswer is true, provide a helpful response starting with "**Bottom Line:**"
4. If canAnswer is false, leave response as an empty string
5. Be conservative - only answer if you're confident the FDA data contains the needed information`
        },
        {
          role: 'user',
          content: `${conversationContext}

Current Follow-up Question: ${query}

${fdaContext || 'No FDA data available.'}

Can you answer this follow-up question using only the available FDA data? Respond in JSON format.`
        }
      ],
      temperature: 0.1,
      max_tokens: 1000,
    })

    const responseText = completion.choices[0]?.message?.content?.trim()
    console.log('🤖 AI Response from saved data:', responseText)
    
    if (!responseText) {
      return { canAnswer: false, content: '', citations: [] }
    }

    try {
      const parsed = JSON.parse(responseText)
      
      if (parsed.canAnswer === true && parsed.response) {
        console.log('✅ AI can answer from saved data')
        
        // Create citations from the FDA sections used
        const citations = fdaSections.map((section: string, index: number) => ({
          id: index + 1,
          title: `FDA ${section.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}`,
          url: `https://www.fda.gov/drugs/drug-approvals-and-databases/approved-drug-products-therapeutic-equivalence-evaluations-orange-book`,
          snippet: `Information from FDA ${section} section for ${originalQuery.medication_name}`
        }))
        
        return { canAnswer: true, content: parsed.response, citations }
      } else {
        console.log('❌ AI cannot answer from saved data')
        return { canAnswer: false, content: '', citations: [] }
      }
    } catch (parseError) {
      console.error('❌ Error parsing AI response:', parseError)
      return { canAnswer: false, content: '', citations: [] }
    }
  } catch (error) {
    console.error('Error answering from saved data:', error)
    return { canAnswer: false, content: '', citations: [] }
  }
}

export async function POST(request: NextRequest) {
  console.log('🚀 Smart follow-up API called')
  console.log('🌐 Request URL:', request.url)
  console.log('🔗 Request headers:', Object.fromEntries(request.headers.entries()))
  
  try {
    const body = await request.json()
    const { query, queryId, forceIntent } = body
    console.log('📝 Request body:', { query, queryId, forceIntent })
    console.log('📝 Body keys:', Object.keys(body))
    console.log('📝 Body size:', JSON.stringify(body).length)

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

    if (!query?.trim() || !queryId) {
      console.log('❌ Missing query or queryId')
      return NextResponse.json(
        { error: 'Query and queryId are required' },
        { status: 400 }
      )
    }

    // Get the original query and conversation context
    console.log('🔍 Looking for query:', queryId, 'for user:', user.id)
    console.log('🔍 QueryId type:', typeof queryId, 'length:', queryId?.length)
    
    // First, check if the query exists at all (without user filter)
    const { data: queryExists, error: existsError } = await supabase
      .from('fda_queries')
      .select('id, user_id, user_query, medication_name')
      .eq('id', queryId)
      .single()
    
    console.log('🔍 Query exists check:', { queryExists: !!queryExists, existsError })
    if (queryExists) {
      console.log('🔍 Found query belongs to user:', queryExists.user_id, 'current user:', user.id)
      console.log('🔍 Query details:', { 
        medication: queryExists.medication_name, 
        query: queryExists.user_query?.substring(0, 50) + '...' 
      })
    }
    
    // Now get the query with user filter
    const { data: originalQuery, error: queryError } = await supabase
      .from('fda_queries')
      .select('*')
      .eq('id', queryId)
      .eq('user_id', user.id)
      .single()

    console.log('📊 User-filtered query result:', { originalQuery: !!originalQuery, queryError })
    if (queryError || !originalQuery) {
      console.log('❌ Query not found or error:', queryError)
      
      // Provide more specific error messages
      if (queryExists && queryExists.user_id !== user.id) {
        console.log('🚫 Query belongs to different user - unauthorized access attempt')
        return NextResponse.json(
          { error: 'Query not found or unauthorized - query belongs to different user' },
          { status: 404 }
        )
      } else if (!queryExists) {
        console.log('🚫 Query does not exist in database')
        return NextResponse.json(
          { error: 'Query not found - query does not exist' },
          { status: 404 }
        )
      } else {
        console.log('🚫 Unknown error accessing query')
        return NextResponse.json(
          { error: 'Query not found or unauthorized - unknown error' },
          { status: 404 }
        )
      }
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
    let savedDataResponse: any = null

    // Get the base URL from request headers for proper production support
    const baseUrl = getBaseUrl(request)

    // Step 3: Handle the query based on intent
    if (isWebSearchIntent) {
      // Web search intent - use web search directly
      console.log('🌐 Processing web search request')
      try {
        
        const webSearchResponse = await fetch(`${baseUrl}/api/follow-up-websearch`, {
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
      savedDataResponse = await tryAnswerFromSavedData(query, originalQuery, previousMessages || [])
      
      console.log('🔍 savedDataResponse.canAnswer:', savedDataResponse.canAnswer)
      console.log('🔍 savedDataResponse.content preview:', savedDataResponse.content.substring(0, 100))
      console.log('🔍 savedDataResponse full content:', savedDataResponse.content)
      console.log('🔍 savedDataResponse citations:', savedDataResponse.citations)
      
      if (savedDataResponse.canAnswer) {
        console.log('✅ Answered from saved FDA data')
        responseContent = savedDataResponse.content
        citations = savedDataResponse.citations || []
        websearchUsed = false
      } else {
        console.log('❌ Cannot answer from saved data, performing full FDA search workflow')
        
        try {
          // Step 1: Extract medication and intent from the follow-up query
          console.log('🔍 Step 1: Extracting medication and intent from query')
          const extractResponse = await fetch(`${baseUrl}/api/extract-medication`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query })
          })

          if (!extractResponse.ok) {
            throw new Error('Failed to extract medication and intent')
          }

          const extractResult = await extractResponse.json()
          console.log('🔍 Extraction result:', extractResult)
          
          const medication = extractResult.medication || originalQuery.medication_name
          const fdaSections = extractResult.fdaSections || []
          
          if (!medication) {
            console.log('❌ No medication found in query, using original medication')
            responseContent = 'I need more specific information about which medication you\'re asking about. Could you please clarify?'
            citations = []
            websearchUsed = false
          } else {
            // Step 2: Perform full FDA search using generate-response workflow
            console.log(`🏥 Step 2: Performing FDA search for medication: ${medication}`)
            const generateResponse = await fetch(`${baseUrl}/api/generate-response`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify({
                query: query,
                medication: medication,
                fdaSections: fdaSections,
                saveToDatabase: false, // Smart follow-up handles its own database saving
                intents: extractResult.intents || []
              })
            })

            if (generateResponse.ok) {
              const result = await generateResponse.json()
              console.log('✅ Full FDA search successful')
              responseContent = result.response || 'No FDA search results found.'
              
              // Generate FDA citations based on the sections searched
              citations = fdaSections?.map((section: string, index: number) => ({
                title: `FDA ${section.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}`,
                url: `https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=${encodeURIComponent(medication || '')}`,
                snippet: `Official FDA information from ${section.replace(/_/g, ' ')} section for ${medication}`,
                display_url: 'dailymed.nlm.nih.gov'
              })) || []
              
              // Add general FDA source if no specific sections
              if (citations.length === 0 && medication) {
                citations = [{
                  title: `FDA Drug Information for ${medication}`,
                  url: `https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=${encodeURIComponent(medication)}`,
                  snippet: `Official FDA drug labeling information for ${medication}`,
                  display_url: 'dailymed.nlm.nih.gov'
                }]
              }
              
              websearchUsed = false
              console.log('📝 Generated citations:', citations.length)
              console.log('📝 Final responseContent after full FDA search:', responseContent.substring(0, 200))
            } else {
              console.log('❌ Generate response failed')
              responseContent = 'I apologize, but I was unable to perform an FDA search at this time. Please try again later.'
              citations = []
              websearchUsed = false
            }
          }
        } catch (error) {
          console.error('❌ Full FDA search workflow error:', error)
          responseContent = 'I apologize, but I encountered an error while searching the FDA database. Please try again later.'
          citations = []
          websearchUsed = false
        }
      }
    }

    // Save the question and answer to database
    console.log('💾 Saving smart follow-up messages to database...')
    
    // Use the user we already have from earlier in the function
    if (!user) {
      console.error('❌ No user found for saving messages')
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }
    
    // Check for recent duplicate questions to prevent double-submission
    // But allow duplicates if we performed a new FDA search with different results
    const performedNewSearch = !savedDataResponse?.canAnswer && !isWebSearchIntent
    
    if (!performedNewSearch) {
      const { data: recentMessages } = await supabase
        .from('fda_messages')
        .select('content, created_at')
        .eq('query_id', queryId)
        .eq('user_id', user.id)
        .eq('message_type', 'question')
        .order('created_at', { ascending: false })
        .limit(3)
      
      // Check if this exact question was asked in the last 30 seconds
      const isDuplicate = recentMessages?.some(msg => 
        msg.content.trim() === query.trim() && 
        new Date().getTime() - new Date(msg.created_at).getTime() < 30000
      )
      
      if (isDuplicate) {
        console.log('⚠️ Duplicate question detected, skipping save')
        return NextResponse.json({ 
          response: 'Question already processed recently',
          intent: isWebSearchIntent ? 'web_search' : 'fda_search'
        })
      }
    } else {
      console.log('🔄 Allowing save because we performed a new FDA search')
    }

    try {
      // Map intent to valid follow_up_mode values
      const followUpMode = isWebSearchIntent ? 'websearch' : 'fda_docs'
      
      console.log('💾 Starting database save process...')
      console.log('💾 Save parameters:', {
        queryId,
        userId: user.id,
        followUpMode,
        websearchUsed,
        queryLength: query.length,
        responseLength: responseContent.length,
        citationsCount: citations?.length || 0
      })
      
      // Save the question
      console.log('💾 Saving question to database...')
      const { data: questionData, error: questionError } = await supabase
        .from('fda_messages')
        .insert({
          query_id: queryId,
          user_id: user.id,
          message_type: 'question',
          content: query,
          follow_up_mode: followUpMode,
          websearch_enabled: websearchUsed
        })
        .select()
        .single()

      if (questionError) {
        console.error('❌ Error saving question:', questionError)
      } else {
        console.log('✅ Question saved successfully:', questionData?.id)
        console.log('🕰️ Question saved at timestamp:', new Date().toISOString())
      }

      // Save the answer
      console.log('💾 Saving answer to database...')
      console.log('📝 Citations being saved:', JSON.stringify(citations, null, 2))
      console.log('📝 Citations count:', citations?.length || 0)
      
      const { data: answerData, error: answerError } = await supabase
        .from('fda_messages')
        .insert({
          query_id: queryId,
          user_id: user.id,
          message_type: 'answer',
          content: responseContent,
          citations: citations || null,
          follow_up_mode: followUpMode,
          websearch_enabled: websearchUsed
        })
        .select()
        .single()

      if (answerError) {
        console.error('❌ Error saving answer:', answerError)
      } else {
        console.log('✅ Answer saved successfully:', answerData?.id)
        console.log('🕰️ Answer saved at timestamp:', new Date().toISOString())
        
        // Add a small delay to ensure database write is committed
        await new Promise(resolve => setTimeout(resolve, 50))
        console.log('🕰️ Database write delay completed')
      }

    } catch (dbError) {
      console.error('❌ Database save error:', dbError)
      // Don't fail the request if database save fails
    }

    // Return success response
    console.log('✅ Smart follow-up completed successfully')
    console.log('📊 Final response stats:', {
      responseLength: responseContent.length,
      citationsCount: citations?.length || 0,
      intent: isWebSearchIntent ? 'web_search' : 'fda_search',
      websearchUsed,
      performedNewSearch: !savedDataResponse?.canAnswer && !isWebSearchIntent
    })
    
    return NextResponse.json({
      response: responseContent,
      intent: isWebSearchIntent ? 'web_search' : 'fda_search',
      citations: citations,
      websearchUsed: websearchUsed,
      performedNewSearch: !savedDataResponse?.canAnswer && !isWebSearchIntent
    })

  } catch (error) {
    console.error('🔥 Smart follow-up error:', error)
    console.error('🔥 Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('🔥 Error message:', error instanceof Error ? error.message : String(error))
    console.error('🔥 Error type:', typeof error)
    console.error('🔥 Error constructor:', error?.constructor?.name)
    
    // Return detailed error for debugging
    const errorDetails = {
      message: error instanceof Error ? error.message : String(error),
      type: typeof error,
      constructor: error?.constructor?.name,
      stack: error instanceof Error ? error.stack : undefined
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: errorDetails,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
