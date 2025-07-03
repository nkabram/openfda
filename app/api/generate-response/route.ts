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
    indications_and_usage?: string[]
    dosage_and_administration?: string[]
    drug_interactions?: string[]
  }>
}

async function searchMedicationInOpenFDA(medicationName: string): Promise<OpenFDAResponse | null> {
  try {
    const cleanMedication = medicationName.trim().toLowerCase()
    const apiKey = process.env.OPENFDA_API_KEY
    const baseUrl = 'https://api.fda.gov/drug/label.json'
    
    // Try multiple search strategies
    const searchQueries = [
      `openfda.generic_name:"${cleanMedication}"`,
      `openfda.brand_name:"${cleanMedication}"`,
      `openfda.generic_name:${cleanMedication}`,
      `openfda.brand_name:${cleanMedication}`
    ]

    for (const searchQuery of searchQueries) {
      const url = `${baseUrl}?search=${encodeURIComponent(searchQuery)}&limit=5${apiKey ? `&api_key=${apiKey}` : ''}`
      
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

export async function POST(request: NextRequest) {
  try {
    const { query, medication, openfdaData } = await request.json()

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      )
    }

    // Fetch OpenFDA data if medication is provided and data not already fetched
    let fdaData = openfdaData
    if (medication && !fdaData) {
      fdaData = await searchMedicationInOpenFDA(medication)
    }

    // Prepare context for AI response - truncate to avoid token limits
    let context = ''
    if (fdaData && fdaData.results && fdaData.results.length > 0) {
      const result = fdaData.results[0]
      
      // Helper function to truncate text to avoid token limits
      const truncateText = (text: string, maxLength: number = 500) => {
        if (text.length <= maxLength) return text
        return text.substring(0, maxLength) + '...'
      }
      
      const joinAndTruncate = (arr: string[] | undefined, maxLength: number = 300) => {
        if (!arr || arr.length === 0) return 'Not specified'
        const joined = arr.join(' ')
        return truncateText(joined, maxLength)
      }
      
      context = `
FDA Drug Information for ${medication}:

Brand Names: ${result.openfda?.brand_name?.join(', ') || 'Not specified'}
Generic Names: ${result.openfda?.generic_name?.join(', ') || 'Not specified'}
Manufacturer: ${result.openfda?.manufacturer_name?.join(', ') || 'Not specified'}

Indications and Usage: ${joinAndTruncate(result.indications_and_usage, 400)}
Dosage and Administration: ${joinAndTruncate(result.dosage_and_administration, 300)}
Warnings: ${joinAndTruncate(result.warnings, 400)}
Contraindications: ${joinAndTruncate(result.contraindications, 200)}
Adverse Reactions: ${joinAndTruncate(result.adverse_reactions, 300)}
Drug Interactions: ${joinAndTruncate(result.drug_interactions, 300)}
      `.trim()
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a knowledgeable medication information assistant. You provide accurate, helpful information about medications based on FDA data and medical knowledge.

Guidelines:
1. Always prioritize FDA-approved information when available
2. Be clear about the source of your information
3. If no FDA data is available, decline to provide an answer. 
4. Be concise but comprehensive
5. Use clear, accessible language, for a medical professional audience, ie doctors, pharmacists, physician assistants, nurse practitioners, and nurses

RESPONSE FORMAT:
Start your response with "**Bottom Line:** [One sentence summary that directly answers the user's question]"

Then provide the detailed explanation below.`
        },
        {
          role: 'user',
          content: `User Question: ${query}

${context ? `FDA Data Available:\n${context}` : 'No specific FDA data available for this query.'}

Please provide a helpful response to the user's question.`
        }
      ],
      temperature: 0.1,
      max_tokens: 1000,
    })

    const response = completion.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response to your question.'

    return NextResponse.json({
      response,
      medication,
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
