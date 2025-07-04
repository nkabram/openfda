import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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
  try {
    const cleanMedication = medicationName.trim().toLowerCase()
    const apiKey = process.env.OPENFDA_API_KEY
    const baseUrl = 'https://api.fda.gov/drug/label.json'
    
    const searchQueries = [
      `openfda.generic_name:"${cleanMedication}"`,
      `openfda.brand_name:"${cleanMedication}"`,
      `openfda.generic_name:${cleanMedication}`,
      `openfda.brand_name:${cleanMedication}`
    ]

    for (const searchQuery of searchQueries) {
      const url = `${baseUrl}?search=${encodeURIComponent(searchQuery)}&limit=${limit}${apiKey ? `&api_key=${apiKey}` : ''}`
      
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        if (data.results && data.results.length > 0) {
          return data
        }
      }
    }

    return null
  } catch (error) {
    console.error('Error searching OpenFDA:', error)
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
    const { query, medication, intents, fdaSections, openfdaData } = await request.json()

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      )
    }

    let fdaData = openfdaData
    if (medication && !fdaData) {
      const rawFdaData = await searchMedicationInOpenFDA(medication, 3)
      if (rawFdaData && fdaSections && fdaSections.length > 0) {
        fdaData = extractRelevantSections(rawFdaData.results || [], fdaSections, intents || [])
      }
    }

    const context = fdaData ? formatFDAContext(fdaData, medication, intents || []) : ''

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

RESPONSE FORMAT:
Start your response with "**Bottom Line:** [One sentence summary that directly answers the user's question]"

Then provide the detailed explanation below, organized by relevant sections.`
        },
        {
          role: 'user',
          content: `User Question: ${query}

${context ? `FDA Data Available:\n${context}` : 'No specific FDA data available for this query.'}

Please provide a helpful response to the user's question, focusing on the specific information they requested.`
        }
      ],
      temperature: 0.1,
      max_tokens: 2000,
    })

    const response = completion.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response to your question.'

    return NextResponse.json({
      response,
      medication,
      intents: intents || [],
      fdaSections: fdaSections || [],
      fdaData: fdaData || null
    })
  } catch (error) {
    console.error('Error generating response:', error)
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    )
  }
}
