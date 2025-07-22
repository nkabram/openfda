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

// OpenFDA API search function (copied from generate-response)
async function searchMedicationInOpenFDA(medicationName: string, limit: number = 5): Promise<any | null> {
  console.log(`🏥 Starting FDA search for medication: "${medicationName}" (limit: ${limit})`)
  
  try {
    const cleanMedication = medicationName.trim().toLowerCase()
    const apiKey = process.env.OPENFDA_API_KEY
    const baseUrl = 'https://api.fda.gov/drug/label.json'
    
    console.log(`🔍 Cleaned medication name: "${cleanMedication}"`)
    console.log(`🔑 API Key available: ${apiKey ? 'Yes' : 'No'}`)
    
    const searchQueries = [
      `openfda.generic_name:"${cleanMedication}"`,
      `openfda.brand_name:"${cleanMedication}"`,
      `openfda.generic_name:${cleanMedication}`,
      `openfda.brand_name:${cleanMedication}`
    ]
    
    console.log(`📋 Trying ${searchQueries.length} search strategies`)

    for (let i = 0; i < searchQueries.length; i++) {
      const searchQuery = searchQueries[i]
      const url = `${baseUrl}?search=${encodeURIComponent(searchQuery)}&limit=${limit}${apiKey ? `&api_key=${apiKey}` : ''}`
      
      console.log(`🔍 Strategy ${i + 1}/${searchQueries.length}: ${searchQuery}`)
      
      const startTime = Date.now()
      const response = await fetch(url)
      const responseTime = Date.now() - startTime
      
      console.log(`⏱️ FDA API response time: ${responseTime}ms`)
      console.log(`📊 Response status: ${response.status} ${response.statusText}`)
      
      if (response.ok) {
        const data = await response.json()
        console.log(`✅ FDA search successful! Found ${data.results?.length || 0} results`)
        return data
      } else {
        console.log(`❌ Strategy ${i + 1} failed: ${response.status} ${response.statusText}`)
      }
    }
    
    console.log(`❌ All FDA search strategies failed`)
    return null
  } catch (error) {
    console.error('❌ Error searching OpenFDA:', error)
    return null
  }
}

// Extract relevant sections from FDA results
function extractRelevantSections(results: any[], fdaSections: string[], intents: string[]) {
  const extractedData: any = {}
  
  results.forEach(result => {
    fdaSections.forEach(section => {
      if (result[section] && Array.isArray(result[section])) {
        if (!extractedData[section]) {
          extractedData[section] = []
        }
        extractedData[section].push(...result[section])
      }
    })
  })
  
  return extractedData
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
    const { queryId, followUpQuestion, mode = 'fda_docs', skipSave = false } = await request.json()

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

    // Always get user from request for proper authentication
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    const userId = user.id

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
    let newFdaData = null
    let performedNewSearch = false
    
    if (mode === 'fda_docs') {
      // First try to use existing saved FDA data
      if (originalQuery.fda_raw_data) {
        const fdaResult = formatFDADataForContext(originalQuery.fda_raw_data, originalQuery.medication_name || 'the medication')
        fdaContext = fdaResult.context
        availableSections = fdaResult.availableSections
        console.log('💾 Using existing FDA data, available sections:', availableSections)
      }
      
      // Check if the question is about a different medication
      const questionLower = followUpQuestion.toLowerCase()
      const currentMedication = originalQuery.medication_name?.toLowerCase() || ''
      
      // Common medication names that might indicate a different drug
      const medicationKeywords = [
        'azithromycin', 'amoxicillin', 'ciprofloxacin', 'doxycycline', 'metronidazole',
        'cephalexin', 'clindamycin', 'erythromycin', 'penicillin', 'tetracycline',
        'vancomycin', 'gentamicin', 'tobramycin', 'ceftriaxone', 'cefazolin'
      ]
      
      const mentionedMedication = medicationKeywords.find(med => 
        questionLower.includes(med) && med !== currentMedication
      )
      
      if (mentionedMedication) {
        console.log(`🔍 Question mentions different medication: ${mentionedMedication} (current: ${currentMedication})`)
        console.log('🔍 Will perform new FDA search for the mentioned medication')
        
        // Perform new search for the mentioned medication
        try {
          newFdaData = await searchMedicationInOpenFDA(mentionedMedication, 3)
          if (newFdaData && newFdaData.results && newFdaData.results.length > 0) {
            console.log(`✅ New FDA search successful for ${mentionedMedication}`)
            
            const commonSections = [
              'dosage_and_administration',
              'indications_and_usage', 
              'warnings',
              'adverse_reactions',
              'contraindications',
              'drug_interactions',
              'precautions'
            ]
            
            const extractedData = extractRelevantSections(newFdaData.results, commonSections, [])
            const fdaResult = formatFDADataForContext(extractedData, mentionedMedication)
            fdaContext = fdaResult.context
            availableSections = fdaResult.availableSections
            performedNewSearch = true
            
            console.log(`🔄 Updated FDA context with ${mentionedMedication} data, sections:`, availableSections)
          } else {
            console.log(`❌ New FDA search returned no results for ${mentionedMedication}`)
          }
        } catch (error) {
          console.error(`❌ Error performing new FDA search for ${mentionedMedication}:`, error)
        }
      }
      // If no FDA context or very limited context, perform new FDA search
      else if (!fdaContext || fdaContext.length < 100) {
        console.log('🔍 Insufficient FDA data, performing new OpenFDA search...')
        const medicationName = originalQuery.medication_name || 'unknown'
        
        try {
          newFdaData = await searchMedicationInOpenFDA(medicationName, 3)
          if (newFdaData && newFdaData.results && newFdaData.results.length > 0) {
            console.log('✅ New FDA search successful, extracting relevant sections')
            
            // Extract common sections that might be relevant to follow-up questions
            const commonSections = [
              'dosage_and_administration',
              'indications_and_usage', 
              'warnings',
              'adverse_reactions',
              'contraindications',
              'drug_interactions',
              'precautions'
            ]
            
            const extractedData = extractRelevantSections(newFdaData.results, commonSections, [])
            const fdaResult = formatFDADataForContext(extractedData, medicationName)
            fdaContext = fdaResult.context
            availableSections = fdaResult.availableSections
            performedNewSearch = true
            
            console.log('🔄 Updated FDA context with new data, sections:', availableSections)
          } else {
            console.log('❌ New FDA search returned no results')
          }
        } catch (error) {
          console.error('❌ Error performing new FDA search:', error)
        }
      }
    }

    // Create the prompt based on mode
    let systemPrompt = ''
    let userPrompt = ''

    if (mode === 'fda_docs') {
      systemPrompt = `You are a knowledgeable medication information assistant. You are answering a follow-up question based on FDA documentation${performedNewSearch ? ' that was just retrieved from the OpenFDA database' : ' that was previously retrieved'}. 

Guidelines:
1. Use ONLY the FDA data provided to answer the question
2. If the FDA data doesn't contain information to answer the question, respond with "**Bottom Line:** Unable to find this information in the available FDA sections."
3. If you CAN answer with the available data, provide a comprehensive response starting with "**Bottom Line:**"
4. Be accurate and cite specific sections when possible
5. ${performedNewSearch ? 'This information comes from a fresh FDA database search.' : 'This uses previously saved FDA data.'}
5. Maintain the conversation context from previous exchanges
6. Use clear, accessible language for medical professionals
7. Do NOT include a "References:" section - source attribution is handled separately

IMPORTANT: Do not make up information that is not in the FDA data provided. When information is missing, use the exact format specified in guideline 2.`

      // Debug logging for FDA context
      console.log('🔍 FDA Context length:', fdaContext?.length || 0)
      console.log('🔍 FDA Context preview (first 500 chars):', fdaContext?.substring(0, 500) || 'No context')
      console.log('🔍 Available sections count:', availableSections.length)
      console.log('🔍 Follow-up question:', followUpQuestion)
      
      userPrompt = `${conversationContext}

Current Follow-up Question: ${followUpQuestion}

${fdaContext ? `Available FDA Data:
${fdaContext}` : 'No FDA data available for this medication.'}

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

    // Save the follow-up question and answer to the database (unless skipSave is true)
    if (!skipSave) {
      console.log('💾 Saving follow-up messages to database...')
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
      console.log('✅ Follow-up messages saved successfully')
    } else {
      console.log('⏭️ Skipping message save (called internally)')
    }

    return NextResponse.json({
      response: aiResponse,
      mode: mode,
      fdaDataUsed: mode === 'fda_docs' && !!fdaContext,
      needsMoreInfo: needsMoreInfo,
      searchedSections: searchedSections,
      medication: originalQuery.medication_name,
      performedNewSearch: performedNewSearch,
      newDataAvailable: performedNewSearch && !!fdaContext
    })

  } catch (error) {
    console.error('Error processing follow-up:', error)
    return NextResponse.json(
      { error: 'Failed to process follow-up question' },
      { status: 500 }
    )
  }
}
