import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface IntentDetectionRequest {
  query: string
  conversationContext?: string
  previousResponse?: string
  medicationName?: string
}

interface IntentDetectionResponse {
  intent: 'clarification' | 'fda_search' | 'web_search'
  confidence: number
  reasoning: string
  suggestedAction: string
}

export async function POST(request: NextRequest) {
  try {
    const body: IntentDetectionRequest = await request.json()
    const { query, conversationContext, previousResponse, medicationName } = body

    if (!query?.trim()) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    // Create the system prompt for intent detection
    const systemPrompt = `You are an expert intent classifier for a medical information system. Your job is to analyze user follow-up questions and classify them into one of three categories:

1. **clarification** - Questions about previously generated content, requests for explanation, or general clarification
   - Examples: "What does this mean?", "Can you explain that better?", "Tell me more about the side effects you mentioned"
   - Indicators: References to previous response, requests for clarification, "what", "how", "why" questions about existing content

2. **fda_search** - Questions about new medications or different drug information requiring FDA database lookup
   - Examples: "What about ibuprofen?", "Tell me about aspirin interactions", "Is metformin safe during pregnancy?"
   - Indicators: New medication names, specific drug questions, dosage/interaction/safety queries for different substances

3. **web_search** - Questions requiring current information, recent research, or external data
   - Examples: "Latest research on...", "Recent studies about...", "Current guidelines for...", "What's the news on..."
   - Indicators: "latest", "recent", "current", "new", "studies", "research", "guidelines", temporal references

Analyze the user's query and provide your classification with confidence score (0-100) and reasoning.

Context Information:
- Previous medication discussed: ${medicationName || 'None'}
- Previous response available: ${previousResponse ? 'Yes' : 'No'}
- Conversation context: ${conversationContext || 'None'}

Respond with a JSON object containing:
- intent: one of the three categories
- confidence: number between 0-100
- reasoning: brief explanation of your classification
- suggestedAction: what the system should do next`

    const userPrompt = `Classify this follow-up question: "${query}"`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 300,
    })

    const responseText = completion.choices[0]?.message?.content
    if (!responseText) {
      throw new Error('No response from OpenAI')
    }

    // Parse the JSON response
    let result: IntentDetectionResponse
    try {
      result = JSON.parse(responseText)
    } catch (parseError) {
      // Fallback if JSON parsing fails
      console.error('Failed to parse OpenAI response:', responseText)
      result = {
        intent: 'clarification',
        confidence: 50,
        reasoning: 'Failed to parse intent, defaulting to clarification',
        suggestedAction: 'Provide clarification based on previous response'
      }
    }

    // Validate the response
    if (!['clarification', 'fda_search', 'web_search'].includes(result.intent)) {
      result.intent = 'clarification'
      result.confidence = 50
      result.reasoning = 'Invalid intent detected, defaulting to clarification'
    }

    // Ensure confidence is within valid range
    result.confidence = Math.max(0, Math.min(100, result.confidence))

    return NextResponse.json(result)

  } catch (error) {
    console.error('Intent detection error:', error)
    
    // Return a safe fallback response
    return NextResponse.json({
      intent: 'clarification',
      confidence: 50,
      reasoning: 'Error occurred during intent detection, defaulting to clarification',
      suggestedAction: 'Provide clarification based on previous response'
    })
  }
}
