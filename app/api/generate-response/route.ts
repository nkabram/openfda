import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

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

interface OpenFDAResponse {
  results?: Array<{
    openfda?: {
      brand_name?: string[]
      generic_name?: string[]
      manufacturer_name?: string[]
    }
    warnings?: string[]
    contraindications?: string[]
    adverse_reactions?: string[]
    adverse_reactions_table?: string[]
    indications_and_usage?: string[]
    dosage_and_administration?: string[]
    dosage_and_administration_table?: string[]
    dosage_forms_and_strengths?: string[]
    drug_interactions?: string[]
    
    active_ingredient?: string[]
    inactive_ingredient?: string[]
    
    boxed_warning?: string[]
    precautions?: string[]
    general_precautions?: string[]
    user_safety_warnings?: string[]
    
    pregnancy?: string[]
    pregnancy_table?: string[]
    teratogenic_effects?: string[]
    nursing_mothers?: string[]
    lactation?: string[]
    pediatric_use?: string[]
    geriatric_use?: string[]
    labor_and_delivery?: string[]
    use_in_specific_populations?: string[]
    
    when_using?: string[]
    stop_use?: string[]
    patient_medication_information?: string[]
    
    description?: string[]
    purpose?: string[]
    animal_pharmacology_and_or_toxicology?: string[]
    carcinogenesis_and_mutagenesis?: string[]
    storage_and_handling?: string[]
    how_supplied?: string[]
  }>
}

async function searchMedicationInOpenFDA(medicationName: string, limit: number = 5): Promise<OpenFDAResponse | null> {
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
      console.log(`🌐 FDA API URL: ${url.replace(apiKey || '', '***API_KEY***')}`)
      
      const startTime = Date.now()
      const response = await fetch(url)
      const responseTime = Date.now() - startTime
      
      console.log(`⏱️ FDA API response time: ${responseTime}ms`)
      console.log(`📊 Response status: ${response.status} ${response.statusText}`)
      
      if (response.ok) {
        const data = await response.json()
        console.log(`📦 Response data structure:`, {
          hasResults: !!data.results,
          resultCount: data.results?.length || 0,
          hasError: !!data.error
        })
        
        if (data.results && data.results.length > 0) {
          console.log(`✅ FDA search successful! Found ${data.results.length} results in ${responseTime}ms`)
          
          // Log summary of first result
          const firstResult = data.results[0]
          console.log(`📋 First result summary:`, {
            brandNames: firstResult.openfda?.brand_name?.slice(0, 3) || [],
            genericNames: firstResult.openfda?.generic_name?.slice(0, 3) || [],
            manufacturer: firstResult.openfda?.manufacturer_name?.[0] || 'Unknown',
            availableSections: Object.keys(firstResult).filter(key => 
              ['indications_and_usage', 'dosage_and_administration', 'contraindications', 
               'warnings_and_cautions', 'adverse_reactions', 'drug_interactions'].includes(key)
            )
          })
          
          return data
        } else {
          console.log(`⚠️ Strategy ${i + 1} returned no results`)
        }
      } else {
        console.log(`❌ Strategy ${i + 1} failed: ${response.status} ${response.statusText}`)
        
        if (response.status === 429) {
          console.log(`🚫 Rate limit detected! Consider adding delays between requests.`)
        }
        
        try {
          const errorData = await response.json()
          console.log(`🔥 Error details:`, errorData)
        } catch (e) {
          console.log(`🔥 Could not parse error response`)
        }
      }
    }

    console.log(`❌ All FDA search strategies exhausted. No results found for "${medicationName}"`)
    return null
  } catch (error) {
    console.error('🔥 Error searching OpenFDA:', error)
    console.error('🔥 Stack trace:', error instanceof Error ? error.stack : 'No stack trace')
    return null
  }
}

function extractRelevantSections(results: any[], fdaSections: string[], intents: string[]) {
  if (!results || results.length === 0) return null

  const relevantData = results.map(result => {
    const extractedData: any = {
      openfda: result.openfda || {},
      sections: {}
    }

    fdaSections.forEach(section => {
      if (result[section]) {
        extractedData.sections[section] = result[section]
      }
    })

    return extractedData
  })

  return {
    results: relevantData,
    intents,
    fdaSections
  }
}

function formatFDAContext(fdaData: any, medication: string, intents: string[]) {
  if (!fdaData || !fdaData.results || fdaData.results.length === 0) {
    return ''
  }

  let context = `FDA Drug Information for ${medication}:\n\n`
  
  const firstResult = fdaData.results[0]
  if (firstResult.openfda) {
    context += `Brand Names: ${firstResult.openfda.brand_name?.join(', ') || 'Not specified'}\n`
    context += `Generic Names: ${firstResult.openfda.generic_name?.join(', ') || 'Not specified'}\n`
    context += `Manufacturer: ${firstResult.openfda.manufacturer_name?.join(', ') || 'Not specified'}\n\n`
  }

  const intentLabels = {
    'dosage_administration': 'DOSAGE AND ADMINISTRATION',
    'ingredients': 'INGREDIENTS',
    'indications_purpose': 'INDICATIONS AND USAGE',
    'contraindications_warnings': 'CONTRAINDICATIONS AND WARNINGS',
    'adverse_reactions': 'ADVERSE REACTIONS',
    'special_populations': 'SPECIAL POPULATIONS',
    'description_info': 'DRUG INFORMATION'
  }

  fdaData.results.forEach((result: any, index: number) => {
    if (index > 0) {
      context += `\n--- Additional Product Information ---\n`
    }

    Object.entries(result.sections || {}).forEach(([sectionKey, sectionValue]) => {
      if (Array.isArray(sectionValue) && sectionValue.length > 0) {
        const sectionTitle = sectionKey.replace(/_/g, ' ').toUpperCase()
        context += `\n${sectionTitle}:\n${sectionValue.join('\n')}\n`
      }
    })
  })

  return context.trim()
}

export async function POST(request: NextRequest) {
  try {
    const { query, medication, intents, fdaSections, openfdaData, saveToDatabase = false } = await request.json()

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
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

    let fdaData = openfdaData
    let rawFdaData = null
    
    if (medication && !fdaData) {
      rawFdaData = await searchMedicationInOpenFDA(medication, 3)
      if (rawFdaData && fdaSections && fdaSections.length > 0) {
        fdaData = extractRelevantSections(rawFdaData.results || [], fdaSections, intents || [])
      }
    }

    const context = fdaData ? formatFDAContext(fdaData, medication, intents || []) : ''
    
    // TODO: review and update system prompt
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-nano',
      messages: [
        {
          role: 'system',
          content: `You are a knowledgeable medication information assistant. You provide accurate, helpful information about medications based on FDA data and medical knowledge.

Guidelines:
1. Always prioritize FDA-approved information when available
2. Be clear about the source of your information
3. If no FDA data is available, decline to provide an answer
4. Be comprehensive but well-organized
5. Use clear, accessible language for a medical professional audience (doctors, pharmacists, physician assistants, nurse practitioners, and nurses)
6. When multiple products are available, mention the variations if relevant
7. Focus your response on the specific intent of the user's question
8. Do NOT include a "References:" section - source attribution is handled separately

RESPONSE FORMAT:
Start your response with "**Bottom Line:** [One sentence summary that directly answers the user's question]"

Then provide the detailed explanation below, organized by relevant sections. Do not include references or citations at the end.`
        },
        {
          role: 'user',
          content: `User Question: ${query}

${context ? `FDA Data Available:\n${context}` : 'No specific FDA data available for this query.'}

Please provide a helpful response to the user's question, focusing on the specific information they requested.`
        }
      ],
      temperature: 0.1,
      max_tokens: 4000,
    })

    const response = completion.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response to your question.'

    let queryId = null
    
    // Save to database if requested
    console.log('saveToDatabase:', saveToDatabase, 'userId:', userId)
    if (saveToDatabase) {
      try {
        const { data: savedQuery, error: saveError } = await supabase
          .from('fda_queries')
          .insert({
            user_id: userId,
            user_query: query,
            medication_name: medication,
            fda_response: fdaData,
            fda_raw_data: rawFdaData,
            fda_sections_used: fdaSections || [],
            detected_intents: intents || [],
            ai_response: response
          })
          .select('id')
          .single()

        if (saveError) {
          console.error('Error saving query:', saveError)
        } else {
          console.log('Query saved successfully with ID:', savedQuery.id)
          queryId = savedQuery.id
        }
      } catch (error) {
        console.error('Error saving to database:', error)
      }
    }

    return NextResponse.json({
      response,
      medication,
      intents: intents || [],
      fdaSections: fdaSections || [],
      fdaData: fdaData || null,
      queryId
    })
  } catch (error) {
    console.error('Error generating response:', error)
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    )
  }
}
