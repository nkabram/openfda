import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Debug: Check what API key is being loaded
const apiKey = process.env.OPENAI_API_KEY
console.log('API Key loaded:', apiKey ? `${apiKey.substring(0, 20)}...${apiKey.slice(-4)}` : 'NOT FOUND')

const openai = new OpenAI({
  apiKey: apiKey,
})

// Define FDA section mappings for intent detection
const FDA_SECTION_MAPPINGS = {
  'dosage_administration': {
    fields: ['dosage_and_administration', 'dosage_and_administration_table', 'dosage_forms_and_strengths'],
    keywords: ['dosage', 'dose', 'administration', 'how to take', 'how much', 'strength', 'mg', 'tablet', 'capsule', 'formulation']
  },
  'ingredients': {
    fields: ['inactive_ingredient', 'active_ingredient'],
    keywords: ['ingredient', 'active', 'inactive', 'component', 'composition', 'what is in']
  },
  'indications_purpose': {
    fields: ['indications_and_usage', 'purpose'],
    keywords: ['indication', 'use', 'purpose', 'treat', 'condition', 'disease', 'what for', 'approved for']
  },
  'contraindications_warnings': {
    fields: ['contraindications', 'boxed_warning', 'precautions', 'general_precautions', 'user_safety_warnings'],
    keywords: ['contraindication', 'warning', 'precaution', 'avoid', 'do not', 'should not', 'dangerous', 'risk', 'black box']
  },
  'adverse_reactions': {
    fields: ['adverse_reactions', 'adverse_reactions_table', 'when_using', 'stop_use', 'patient_medication_information'],
    keywords: ['side effect', 'adverse', 'reaction', 'symptom', 'problem', 'issue', 'bad reaction']
  },
  'special_populations': {
    fields: ['pregnancy', 'pregnancy_table', 'teratogenic_effects', 'nursing_mothers', 'lactation', 'pediatric_use', 'geriatric_use', 'labor_and_delivery', 'use_in_specific_populations'],
    keywords: ['pregnancy', 'pregnant', 'nursing', 'breastfeeding', 'children', 'pediatric', 'elderly', 'geriatric', 'labor', 'delivery']
  },
  'description_info': {
    fields: ['description', 'animal_pharmacology_and_or_toxicology', 'carcinogenesis_and_mutagenesis', 'storage_and_handling', 'how_supplied'],
    keywords: ['description', 'what is', 'storage', 'store', 'keep', 'supplied', 'pharmacology', 'toxicology']
  }
}

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
          content: `You are a medication name and intent extraction assistant. Your job is to identify medication names from user queries and determine what type of information they're seeking.

MEDICATION EXTRACTION RULES:
1. Extract only the primary medication name mentioned in the query
2. Return the generic name if possible, not brand names
3. If multiple medications are mentioned, return the first/primary one
4. If no medication is clearly mentioned, return null
5. Be conservative - only return a name if you're confident it's a medication

INTENT DETECTION RULES:
Analyze the query to determine what FDA information sections are relevant. Map to these categories:

- dosage_administration: Questions about dosing, how to take, strength, formulations
- ingredients: Questions about active/inactive ingredients, composition
- indications_purpose: Questions about what the drug treats, approved uses
- contraindications_warnings: Questions about warnings, precautions, who shouldn't take it
- adverse_reactions: Questions about side effects, adverse reactions
- special_populations: Questions about pregnancy, nursing, children, elderly
- description_info: General questions about the drug, storage, description

RESPONSE FORMAT:
Return a JSON object with:
{
  "medication": "medication_name_or_null",
  "intents": ["array_of_relevant_intent_categories"]
}

EXAMPLES:
- "What are the side effects of ibuprofen?" → {"medication": "ibuprofen", "intents": ["adverse_reactions"]}
- "Can I take Tylenol during pregnancy?" → {"medication": "acetaminophen", "intents": ["special_populations"]}
- "What is the proper dosage of aspirin for adults?" → {"medication": "aspirin", "intents": ["dosage_administration"]}
- "What conditions does metformin treat?" → {"medication": "metformin", "intents": ["indications_purpose"]}
- "What are the ingredients in Advil?" → {"medication": "ibuprofen", "intents": ["ingredients"]}
- "Are there any warnings for lisinopril?" → {"medication": "lisinopril", "intents": ["contraindications_warnings"]}
- "Tell me about atorvastatin" → {"medication": "atorvastatin", "intents": ["description_info"]}
- "What should I know about my blood pressure?" → {"medication": null, "intents": []}`
        },
        {
          role: 'user',
          content: query
        }
      ],
      temperature: 0.1,
      max_tokens: 150,
    })

    const responseText = completion.choices[0]?.message?.content?.trim()
    
    if (!responseText) {
      return NextResponse.json({ medication: null, intents: [] })
    }

    try {
      const parsed = JSON.parse(responseText)
      
      // Validate the response structure
      const medication = parsed.medication === 'null' || !parsed.medication ? null : parsed.medication
      const intents = Array.isArray(parsed.intents) ? parsed.intents : []
      
      return NextResponse.json({ 
        medication, 
        intents,
        fdaSections: intents.length > 0 ? intents.flatMap(intent => FDA_SECTION_MAPPINGS[intent]?.fields || []) : []
      })
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError, 'Response:', responseText)
      return NextResponse.json({ medication: null, intents: [] })
    }
  } catch (error) {
    console.error('Error extracting medication and intent:', error)
    return NextResponse.json(
      { error: 'Failed to extract medication name and intent' },
      { status: 500 }
    )
  }
}
