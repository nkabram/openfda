import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Debug: Check what API key is being loaded
const apiKey = process.env.OPENAI_API_KEY
console.log('API Key loaded:', apiKey ? `${apiKey.substring(0, 20)}...${apiKey.slice(-4)}` : 'NOT FOUND')

const openai = new OpenAI({
  apiKey: apiKey,
})

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      )
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-nano',
      messages: [
        {
          role: 'system',
          content: `You are a medication name extraction assistant. Your job is to identify medication names from user queries.

Rules:
1. Extract only the primary medication name mentioned in the query
2. Return the generic name if possible, not brand names
3. If multiple medications are mentioned, return the first/primary one
4. If no medication is clearly mentioned, return null
5. Return only the medication name, no additional text
6. Be conservative - only return a name if you're confident it's a medication

Examples:
- "What are the side effects of ibuprofen?" → "ibuprofen"
- "Can I take Tylenol with food?" → "acetaminophen"
- "Is aspirin safe during pregnancy?" → "aspirin"
- "What should I know about my blood pressure?" → null`
        },
        {
          role: 'user',
          content: query
        }
      ],
      temperature: 0.1,
      max_tokens: 50,
    })

    const medicationName = completion.choices[0]?.message?.content?.trim()
    
    // Return null if the response indicates no medication was found
    if (!medicationName || medicationName.toLowerCase() === 'null' || medicationName.toLowerCase() === 'none') {
      return NextResponse.json({ medication: null })
    }

    return NextResponse.json({ medication: medicationName })
  } catch (error) {
    console.error('Error extracting medication:', error)
    return NextResponse.json(
      { error: 'Failed to extract medication name' },
      { status: 500 }
    )
  }
}
