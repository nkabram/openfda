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

// Helper function to format FDA data for context
function formatFDADataForContext(fdaData: any, medication: string): { context: string, availableSections: string[] } {
  if (!fdaData || typeof fdaData !== 'object') {
    return { context: '', availableSections: [] }
  }

  let context = `FDA Information for ${medication}:\n\n`
  let availableSections: string[] = []
  
  // Handle both raw FDA data and processed FDA data
  if (fdaData.results && Array.isArray(fdaData.results)) {
    // Raw FDA data format
    fdaData.results.forEach((result: any, index: number) => {
      if (index > 0) context += '\n---\n\n'
      
      Object.keys(result).forEach(key => {
        if (key === 'openfda') return // Skip metadata
        
        const value = result[key]
        if (Array.isArray(value) && value.length > 0) {
          const sectionName = key.replace(/_/g, ' ')
          availableSections.push(sectionName)
          context += `${sectionName.toUpperCase()}:\n`
          value.forEach(item => {
            context += `- ${item}\n`
          })
          context += '\n'
        }
      })
    })
  } else {
    // Processed FDA data format
    Object.keys(fdaData).forEach(section => {
      const sectionData = fdaData[section]
      if (Array.isArray(sectionData) && sectionData.length > 0) {
        const sectionName = section.replace(/_/g, ' ')
        availableSections.push(sectionName)
        context += `${sectionName.toUpperCase()}:\n`
        sectionData.forEach(item => {
          context += `- ${item}\n`
        })
        context += '\n'
      }
    })
  }
  
  return { context, availableSections }
}

export async function POST(request: NextRequest) {
  try {
    const { queryId, followUpQuestion, mode = 'fda_docs' } = await request.json()

    if (!queryId || !followUpQuestion) {
      return NextResponse.json(
        { error: 'Query ID and follow-up question are required' },
        { status: 400 }
      )
    }

    if (!['fda_docs', 'llm_only'].includes(mode)) {
      return NextResponse.json(
        { error: 'Invalid mode. Must be fda_docs or llm_only' },
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

    // Prepare FDA context based on mode
    let fdaContext = ''
    let availableSections: string[] = []
    if (mode === 'fda_docs' && originalQuery.fda_raw_data) {
      const fdaResult = formatFDADataForContext(originalQuery.fda_raw_data, originalQuery.medication_name || 'the medication')
      fdaContext = fdaResult.context
      availableSections = fdaResult.availableSections
    }

    // Create the prompt based on mode
    let systemPrompt = ''
    let userPrompt = ''

    if (mode === 'fda_docs') {
      systemPrompt = `You are a knowledgeable medication information assistant. You are answering a follow-up question based on FDA documentation that was previously retrieved. 

Guidelines:
1. Use ONLY the FDA data provided to answer the question
2. If the FDA data doesn't contain information to answer the question, you MUST respond in this exact format:
   - Start with "**Bottom Line:** Unable to find this information in the saved FDA sections."
   - Then add: "**Suggestion:** Consider doing a new FDA search or web search for more comprehensive information."
   - Then add: "**Need More Info:** true" (this triggers the UI to show search options)
3. If you CAN answer with the available data, provide a normal response starting with "**Bottom Line:**"
4. Be accurate and cite specific sections when possible
5. Maintain the conversation context from previous exchanges
6. Use clear, accessible language for medical professionals
7. Do NOT include a "References:" section - source attribution is handled separately

IMPORTANT: Do not make up information that is not in the FDA data provided. When information is missing, use the exact format specified in guideline 2.`

      userPrompt = `${conversationContext}

Current Follow-up Question: ${followUpQuestion}

${fdaContext ? `Available FDA Data:\n${fdaContext}` : 'No FDA data available for this medication.'}

Please answer the follow-up question using only the FDA data provided above. If the information is not available in the FDA data, clearly state that.`
    } else {
      // llm_only mode
      systemPrompt = `You are a knowledgeable medication information assistant. You are answering a follow-up question based on your general medical knowledge and the conversation context.

Guidelines:
1. Use your general medical knowledge to provide helpful information
2. Be clear that you are providing general information, not specific FDA data
3. Maintain the conversation context from previous exchanges
4. Use clear, accessible language for medical professionals
5. Always recommend consulting official sources or healthcare providers for specific medical decisions
6. ALWAYS start your response with a concise "**Bottom Line:**" summary (1-2 sentences), followed by detailed explanation if needed
7. Do NOT include a "References:" section - source attribution is handled separately

Do not include references or citations at the end of your response.`

      userPrompt = `${conversationContext}

Current Follow-up Question: ${followUpQuestion}

Please answer this follow-up question using your general medical knowledge. Make it clear that this is general information and not specific FDA data.`
    }

    // Generate response using OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-nano',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      temperature: 0.1,
      max_tokens: 1500,
    })

    const aiResponse = completion.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response to your follow-up question.'

    // Parse the AI response to check if more info is needed
    const needsMoreInfo = aiResponse.includes('**Need More Info:** true')
    let searchedSections: string[] = []
    
    if (needsMoreInfo) {
      // Use the actual available sections from the FDA data
      if (availableSections.length > 0) {
        searchedSections = availableSections
      } else if (originalQuery.fda_sections_used) {
        searchedSections = originalQuery.fda_sections_used
      }
    }

    // Save the follow-up question and answer to the database
    const messagesToInsert = [
      {
        query_id: queryId,
        user_id: userId,
        message_type: 'question',
        content: followUpQuestion,
        follow_up_mode: mode
      },
      {
        query_id: queryId,
        user_id: userId,
        message_type: 'answer',
        content: aiResponse,
        follow_up_mode: mode
      }
    ]

    const { error: insertError } = await supabase
      .from('fda_messages')
      .insert(messagesToInsert)

    if (insertError) {
      console.error('Error saving follow-up messages:', insertError)
      return NextResponse.json(
        { error: 'Failed to save follow-up messages' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      response: aiResponse,
      mode: mode,
      fdaDataUsed: mode === 'fda_docs' && !!fdaContext,
      needsMoreInfo: needsMoreInfo,
      searchedSections: searchedSections,
      medication: originalQuery.medication_name
    })

  } catch (error) {
    console.error('Error processing follow-up:', error)
    return NextResponse.json(
      { error: 'Failed to process follow-up question' },
      { status: 500 }
    )
  }
}
