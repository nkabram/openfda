# OpenFDA Query Processing Flow

This document details the complete flow of how user medication queries are processed in the MedGuardRx application, from initial user input through FDA data retrieval to AI-generated responses.

## Overview

The OpenFDA query processing system follows this high-level flow:

1. **User Input** → Query submission through the web interface
2. **Intent Detection** → AI-powered classification of user intent
3. **Medication Extraction** → Identification of medication names and relevant FDA sections
4. **FDA Data Search** → Retrieval of official FDA labeling data
5. **Response Generation** → AI-powered synthesis of FDA data into user-friendly responses
6. **Database Storage** → Persistence of queries and responses for future reference

## Detailed Flow

### 1. User Query Submission

**Component**: `components/medication-query-form.tsx`

Users submit medication queries through the main query form. The form handles validation and initiates the processing pipeline.

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  if (!query.trim()) return

  setIsLoading(true)
  setError(null)
  setResponse(null)
  setProgress({ step: 1, message: 'Identifying medication...' })

  try {
    const result = await submitQuery({
      query: query.trim(),
      saveToDatabase: true
    })
    
    if (result.success) {
      setResponse(result.data)
      setProgress({ step: 4, message: 'Complete!' })
    }
  } catch (error) {
    setError(error.message)
  } finally {
    setIsLoading(false)
  }
}
```

**Hook**: `hooks/useQuerySubmission.ts`

The submission logic is handled by a custom hook that orchestrates the API calls:

```typescript
export const useQuerySubmission = () => {
  const submitQuery = async ({ query, saveToDatabase = true }) => {
    // Step 1: Extract medication and detect intent
    const extractResponse = await fetch('/api/extract-medication', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    })
    
    const extractData = await extractResponse.json()
    
    // Step 2: Generate response using FDA data
    const generateResponse = await fetch('/api/generate-response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        medication: extractData.medication,
        intents: extractData.intents,
        fdaSections: extractData.fdaSections,
        saveToDatabase
      })
    })
    
    return await generateResponse.json()
  }
  
  return { submitQuery }
}
```

### 2. Intent Detection and Medication Extraction

**API Endpoint**: `/app/api/extract-medication/route.ts`

This endpoint uses OpenAI to analyze the user's query and extract:
- The medication name
- User intent categories
- Relevant FDA labeling sections to search

```typescript
export async function POST(request: Request) {
  try {
    const { query } = await request.json()
    
    const systemPrompt = `You are a medical information assistant. Analyze the user's medication query and extract:
    1. The medication name (generic or brand name)
    2. The user's intent categories from: dosage_administration, ingredients, indications_purpose, contraindications_warnings, adverse_reactions, special_populations, description_info
    3. Relevant FDA labeling sections to search
    
    Return a JSON object with: medication, intents, fdaSections`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query }
      ],
      response_format: { type: "json_object" }
    })

    const result = JSON.parse(completion.choices[0].message.content)
    
    // Map intents to FDA section fields
    const fdaSectionMapping = {
      dosage_administration: ['dosage_and_administration', 'dosage_forms_and_strengths'],
      ingredients: ['active_ingredient', 'inactive_ingredient'],
      indications_purpose: ['indications_and_usage', 'purpose'],
      contraindications_warnings: ['contraindications', 'boxed_warning', 'precautions'],
      adverse_reactions: ['adverse_reactions', 'patient_medication_information'],
      special_populations: ['pregnancy', 'nursing_mothers', 'pediatric_use', 'geriatric_use'],
      description_info: ['description', 'storage_and_handling']
    }
    
    const fdaSections = result.intents.flatMap(intent => 
      fdaSectionMapping[intent] || []
    )
    
    return NextResponse.json({
      medication: result.medication,
      intents: result.intents,
      fdaSections: fdaSections
    })
    
  } catch (error) {
    console.error('Error in extract-medication:', error)
    return NextResponse.json(
      { error: 'Failed to extract medication information' },
      { status: 500 }
    )
  }
}
```

### 3. FDA Data Search

**API Endpoint**: `/app/api/generate-response/route.ts`

The core function that searches the OpenFDA database for medication information:

```typescript
async function searchMedicationInOpenFDA(medicationName: string, limit: number = 3) {
  const apiKey = process.env.FDA_API_KEY
  const cleanedName = medicationName.toLowerCase().replace(/[^\w\s]/g, '').trim()
  
  console.log(`🏥 Starting FDA search for medication: "${medicationName}" (limit: ${limit})`)
  console.log(`🔍 Cleaned medication name: "${cleanedName}"`)
  console.log(`🔑 API Key available: ${apiKey ? 'Yes' : 'No'}`)
  
  // Try multiple search strategies
  const searchStrategies = [
    `openfda.generic_name:"${cleanedName}"`,
    `openfda.brand_name:"${cleanedName}"`,
    `openfda.substance_name:"${cleanedName}"`,
    `${cleanedName}`
  ]
  
  console.log(`📋 Trying ${searchStrategies.length} search strategies`)
  
  for (let i = 0; i < searchStrategies.length; i++) {
    const searchQuery = searchStrategies[i]
    console.log(`🔍 Strategy ${i + 1}/${searchStrategies.length}: ${searchQuery}`)
    
    try {
      const url = `https://api.fda.gov/drug/label.json?search=${encodeURIComponent(searchQuery)}&limit=${limit}${apiKey ? `&api_key=${apiKey}` : ''}`
      console.log(`🌐 FDA API URL: ${url.replace(apiKey || '', 'REDACTED')}`)
      
      const startTime = Date.now()
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'MedGuardRx-Research-App/1.0'
        }
      })
      const responseTime = Date.now() - startTime
      
      console.log(`⏱️ FDA API response time: ${responseTime}ms`)
      console.log(`📊 Response status: ${response.status} ${response.statusText}`)
      
      if (response.ok) {
        const data = await response.json()
        console.log(`✅ FDA search successful! Found ${data.results?.length || 0} results in ${responseTime}ms`)
        
        if (data.results && data.results.length > 0) {
          // Log result summary
          const brandNames = data.results.map(r => r.openfda?.brand_name?.[0]).filter(Boolean)
          const manufacturers = data.results.map(r => r.openfda?.manufacturer_name?.[0]).filter(Boolean)
          console.log(`📋 Result summaries:`)
          console.log(`   Brand names: ${brandNames.slice(0, 3).join(', ')}`)
          console.log(`   Manufacturers: ${manufacturers.slice(0, 3).join(', ')}`)
          
          return data.results
        }
      } else if (response.status === 429) {
        console.log(`🚫 Rate limit detected for strategy ${i + 1}`)
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    } catch (error) {
      console.error(`🔥 Error with strategy ${i + 1}:`, error.message)
    }
  }
  
  console.log(`❌ No results found after trying all ${searchStrategies.length} strategies`)
  return []
}
```

### 4. FDA Data Processing

The system extracts relevant sections from FDA labeling data based on the detected intent:

```typescript
function extractRelevantSections(fdaResults: any[], fdaSections: string[]) {
  const extractedData = []
  
  for (const result of fdaResults) {
    const drugData = {
      brand_name: result.openfda?.brand_name?.[0] || 'Unknown',
      generic_name: result.openfda?.generic_name?.[0] || 'Unknown',
      manufacturer: result.openfda?.manufacturer_name?.[0] || 'Unknown',
      sections: {}
    }
    
    // Extract only the requested FDA sections
    for (const section of fdaSections) {
      if (result[section]) {
        drugData.sections[section] = Array.isArray(result[section]) 
          ? result[section].join(' ') 
          : result[section]
      }
    }
    
    extractedData.push(drugData)
  }
  
  return extractedData
}
```

### 5. AI Response Generation

The system uses OpenAI to synthesize FDA data into user-friendly responses:

```typescript
const systemPrompt = `You are a medical information assistant providing accurate information about medications using official FDA data.

IMPORTANT FORMATTING REQUIREMENTS:
1. Always end your response with a "Bottom line:" summary
2. Format it exactly as: "**Bottom line:** [one clear sentence summary]"
3. This bottom line will be extracted and displayed prominently

Guidelines:
- Use only the provided FDA data
- Be accurate and professional
- Include relevant warnings and precautions
- Cite specific FDA sections when appropriate
- Keep the bottom line concise and actionable`

const userPrompt = `User Query: "${query}"
Medication: ${medication}
User Intent: ${intents.join(', ')}

FDA Data:
${JSON.stringify(extractedData, null, 2)}

Please provide a comprehensive response about ${medication} based on the FDA data above.`

const completion = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ],
  temperature: 0.3,
  max_tokens: 2000
})

const aiResponse = completion.choices[0].message.content
```

### 6. Database Storage

**Database Schema**: The system stores queries and responses in PostgreSQL via Supabase:

```sql
-- Main queries table
CREATE TABLE fda_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  user_query TEXT NOT NULL,
  medication_name TEXT,
  fda_response JSONB,
  ai_response TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  fda_raw_data JSONB,
  fda_sections_used TEXT[],
  detected_intents TEXT[]
);

-- Follow-up messages table
CREATE TABLE fda_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id UUID REFERENCES fda_queries(id),
  user_id UUID REFERENCES auth.users(id),
  message_type VARCHAR(20) CHECK (message_type IN ('question', 'answer')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  citations JSONB,
  websearch_enabled BOOLEAN DEFAULT FALSE,
  follow_up_mode VARCHAR(20) CHECK (follow_up_mode IN ('fda_docs', 'websearch', 'llm_only'))
);
```

**Storage Logic**:

```typescript
// Save query to database
if (saveToDatabase && user) {
  const { data: savedQuery, error: saveError } = await supabase
    .from('fda_queries')
    .insert({
      user_id: user.id,
      user_query: query,
      medication_name: medication,
      fda_response: extractedData,
      ai_response: aiResponse,
      fda_raw_data: fdaResults,
      fda_sections_used: fdaSections,
      detected_intents: intents
    })
    .select()
    .single()
    
  if (saveError) {
    console.error('❌ Database save error:', saveError)
  } else {
    console.log('✅ Query saved successfully:', savedQuery.id)
  }
}
```

## Response Format

The final response includes:

```typescript
interface QueryResponse {
  success: boolean
  data: {
    query: string
    medication: string
    intents: string[]
    fdaSections: string[]
    fdaData: FDADrugData[]
    aiResponse: string
    queryId?: string
  }
  error?: string
}
```

## Progress Tracking

The system provides real-time progress updates to users:

```typescript
// Progress states shown to users
const progressSteps = [
  { step: 1, message: 'Identifying medication...' },
  { step: 2, message: 'Searching FDA documentation...' },
  { step: 3, message: 'Generating comprehensive response...' },
  { step: 4, message: 'Complete!' }
]
```

## Error Handling

The system includes comprehensive error handling at each stage:

- **Validation errors**: Invalid input, missing medication names
- **API errors**: FDA API rate limits, network failures
- **AI errors**: OpenAI API failures, parsing errors
- **Database errors**: Storage failures, authentication issues

Each error is logged and user-friendly messages are displayed to guide users on next steps.

## Security and Compliance

- **Authentication**: All queries require valid user sessions
- **RLS Policies**: Database-level security ensures users only see their own data
- **FDA Disclaimers**: Prominent warnings about clinical decision-making
- **Data Privacy**: User queries and responses are securely stored and isolated

This flow ensures that users receive accurate, FDA-backed medication information while maintaining security, performance, and regulatory compliance.
