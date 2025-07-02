# OpenFDA Medication Query App - Next.js Implementation Guide

## Overview
This Next.js application allows users to ask questions about medications and receive AI-powered responses using OpenFDA API data. The app extracts medication names from user queries, fetches FDA documentation, and provides informed answers using LLM analysis.

## Features
- Medication question input with natural language processing
- OpenFDA API integration for FDA drug labeling data
- AI-powered response generation combining FDA data with user queries
- Query history with collapsible sidebar
- Dark theme using Radix UI with indigo accents
- Supabase database integration for response storage

## Tech Stack
- **Framework**: Next.js 14+ with App Router
- **Styling**: Tailwind CSS + Radix UI
- **Database**: Supabase
- **AI**: OpenAI API (or your preferred LLM provider)
- **API**: OpenFDA Drug Label API

## Installation Instructions

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- OpenAI API key (or alternative LLM provider)
- OpenFDA API key (optional but recommended for higher rate limits)

### 1. Initialize Next.js Project

```bash
npx create-next-app@latest openfda-query-app --typescript --tailwind --app
cd openfda-query-app
```

### 2. Install Dependencies

```bash
npm install @radix-ui/react-collapsible @radix-ui/react-dialog @radix-ui/react-button @radix-ui/react-textarea @radix-ui/react-scroll-area @radix-ui/themes @supabase/supabase-js lucide-react clsx tailwind-merge
```

### 3. Environment Variables

Create `.env.local` in the project root:

```env
# OpenAI API
OPENAI_API_KEY=your_openai_api_key_here

# OpenFDA API (optional - increases rate limits)
OPENFDA_API_KEY=your_openfda_api_key_here

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# App Base URL
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 4. Supabase Database Setup

Create the following table in Supabase:

```sql
-- Create queries table
CREATE TABLE queries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_query TEXT NOT NULL,
  extracted_medication VARCHAR(255),
  openfda_response JSONB,
  ai_response TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX idx_queries_created_at ON queries(created_at DESC);
CREATE INDEX idx_queries_medication ON queries(extracted_medication);
```

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── extract-medication/
│   │   │   └── route.ts
│   │   ├── generate-response/
│   │   │   └── route.ts
│   │   └── queries/
│   │       └── route.ts
│   ├── components/
│   │   ├── ui/
│   │   │   ├── button.tsx
│   │   │   ├── textarea.tsx
│   │   │   └── scroll-area.tsx
│   │   ├── medication-query-form.tsx
│   │   ├── query-history.tsx
│   │   └── response-display.tsx
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── openfda.ts
│   │   └── utils.ts
│   ├── types/
│   │   └── index.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
```

## Core Implementation Files

### 1. Types Definition (`src/types/index.ts`)

```typescript
export interface Query {
  id: string;
  user_query: string;
  extracted_medication: string | null;
  openfda_response: any;
  ai_response: string;
  created_at: string;
}

export interface OpenFDAResponse {
  meta: {
    disclaimer: string;
    terms: string;
    license: string;
    last_updated: string;
    results: {
      skip: number;
      limit: number;
      total: number;
    };
  };
  results: Array<{
    indications_and_usage?: string[];
    dosage_and_administration?: string[];
    contraindications?: string[];
    warnings?: string[];
    adverse_reactions?: string[];
    description?: string[];
    clinical_pharmacology?: string[];
    openfda?: {
      brand_name?: string[];
      generic_name?: string[];
      manufacturer_name?: string[];
      product_type?: string[];
    };
  }>;
}
```

### 2. Supabase Configuration (`src/lib/supabase.ts`)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
```

### 3. OpenFDA API Helper (`src/lib/openfda.ts`)

```typescript
import { OpenFDAResponse } from '@/types';

const OPENFDA_BASE_URL = 'https://api.fda.gov/drug/label.json';
const API_KEY = process.env.OPENFDA_API_KEY;

export async function searchMedicationInOpenFDA(medicationName: string): Promise<OpenFDAResponse | null> {
  try {
    // Clean and prepare the medication name for search
    const cleanMedication = medicationName.trim().toLowerCase();
    
    // Try multiple search strategies for better results
    const searchStrategies = [
      `openfda.brand_name:"${cleanMedication}"`,
      `openfda.generic_name:"${cleanMedication}"`,
      `brand_name:"${cleanMedication}"`,
      `generic_name:"${cleanMedication}"`,
      cleanMedication // General search as fallback
    ];

    for (const searchQuery of searchStrategies) {
      const url = new URL(OPENFDA_BASE_URL);
      url.searchParams.set('search', searchQuery);
      url.searchParams.set('limit', '5'); // Limit results for performance
      
      if (API_KEY) {
        url.searchParams.set('api_key', API_KEY);
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const data: OpenFDAResponse = await response.json();
        if (data.results && data.results.length > 0) {
          return data;
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error searching OpenFDA:', error);
    return null;
  }
}

export function formatOpenFDAData(data: OpenFDAResponse): string {
  if (!data.results || data.results.length === 0) {
    return "No FDA labeling information found for this medication.";
  }

  const result = data.results[0];
  const sections = [];

  // Extract key information sections
  if (result.description && result.description.length > 0) {
    sections.push(`DESCRIPTION: ${result.description.join(' ')}`);
  }

  if (result.indications_and_usage && result.indications_and_usage.length > 0) {
    sections.push(`INDICATIONS AND USAGE: ${result.indications_and_usage.join(' ')}`);
  }

  if (result.dosage_and_administration && result.dosage_and_administration.length > 0) {
    sections.push(`DOSAGE AND ADMINISTRATION: ${result.dosage_and_administration.join(' ')}`);
  }

  if (result.contraindications && result.contraindications.length > 0) {
    sections.push(`CONTRAINDICATIONS: ${result.contraindications.join(' ')}`);
  }

  if (result.warnings && result.warnings.length > 0) {
    sections.push(`WARNINGS: ${result.warnings.join(' ')}`);
  }

  if (result.adverse_reactions && result.adverse_reactions.length > 0) {
    sections.push(`ADVERSE REACTIONS: ${result.adverse_reactions.join(' ')}`);
  }

  if (result.clinical_pharmacology && result.clinical_pharmacology.length > 0) {
    sections.push(`CLINICAL PHARMACOLOGY: ${result.clinical_pharmacology.join(' ')}`);
  }

  return sections.join('\n\n');
}
```

### 4. API Route: Extract Medication (`src/app/api/extract-medication/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const EXTRACT_MEDICATION_PROMPT = `You are a medication extraction specialist. Your task is to identify the specific medication mentioned in the user's question.

Instructions:
- Extract only the medication name (brand name or generic name)
- Return only the medication name, nothing else
- If multiple medications are mentioned, return the primary one being asked about
- If no medication is mentioned, return "NONE"
- Do not include dosages, forms, or additional information
- Be as specific as possible (e.g., "ibuprofen" not "pain medication")

Examples:
- "What are the side effects of Tylenol?" → "Tylenol"
- "Can I take ibuprofen with food?" → "ibuprofen"
- "Is Lipitor safe for elderly patients?" → "Lipitor"
- "What pain medications are available?" → "NONE"

User Query: {query}

Medication Name:`;

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: EXTRACT_MEDICATION_PROMPT.replace('{query}', query)
        }
      ],
      max_tokens: 50,
      temperature: 0.1,
    });

    const extractedMedication = completion.choices[0]?.message?.content?.trim();

    if (!extractedMedication || extractedMedication === 'NONE') {
      return NextResponse.json({
        medication: null,
        message: 'No specific medication identified in the query'
      });
    }

    return NextResponse.json({
      medication: extractedMedication
    });

  } catch (error) {
    console.error('Error extracting medication:', error);
    return NextResponse.json(
      { error: 'Failed to extract medication' },
      { status: 500 }
    );
  }
}
```

### 5. API Route: Generate Response (`src/app/api/generate-response/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { searchMedicationInOpenFDA, formatOpenFDAData } from '@/lib/openfda';
import { supabaseAdmin } from '@/lib/supabase';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const RESPONSE_GENERATION_PROMPT = `You are a helpful medical information assistant. Use the provided FDA documentation to answer the user's question about the medication.

IMPORTANT GUIDELINES:
- Base your response primarily on the provided FDA documentation
- If the FDA documentation doesn't contain relevant information, clearly state this
- Do not provide medical advice or recommendations
- Always advise consulting healthcare professionals for medical decisions
- Be accurate and cite the information source
- Keep responses informative but accessible

FDA Documentation:
{fdaData}

User Question: {userQuery}

Please provide a comprehensive answer based on the FDA documentation:`;

export async function POST(request: NextRequest) {
  try {
    const { userQuery, medication } = await request.json();

    if (!userQuery || !medication) {
      return NextResponse.json(
        { error: 'User query and medication are required' },
        { status: 400 }
      );
    }

    // Step 1: Fetch OpenFDA data
    const openFDAResponse = await searchMedicationInOpenFDA(medication);
    
    if (!openFDAResponse) {
      const noDataResponse = `I couldn't find FDA labeling information for "${medication}" in the OpenFDA database. This could be because:

1. The medication name might be spelled differently in the FDA database
2. It might be an over-the-counter medication with limited FDA labeling
3. It could be a very new medication not yet in the database
4. The medication might be known by a different name (brand vs. generic)

Please consult with a healthcare professional or pharmacist for accurate information about this medication.`;

      // Save to database
      await supabaseAdmin
        .from('queries')
        .insert({
          user_query: userQuery,
          extracted_medication: medication,
          openfda_response: null,
          ai_response: noDataResponse,
        });

      return NextResponse.json({
        response: noDataResponse,
        hasFDAData: false
      });
    }

    // Step 2: Format FDA data
    const formattedFDAData = formatOpenFDAData(openFDAResponse);

    // Step 3: Generate AI response
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: RESPONSE_GENERATION_PROMPT
            .replace('{fdaData}', formattedFDAData)
            .replace('{userQuery}', userQuery)
        }
      ],
      max_tokens: 1000,
      temperature: 0.3,
    });

    const aiResponse = completion.choices[0]?.message?.content || 'Unable to generate response';

    // Step 4: Save to database
    await supabaseAdmin
      .from('queries')
      .insert({
        user_query: userQuery,
        extracted_medication: medication,
        openfda_response: openFDAResponse,
        ai_response: aiResponse,
      });

    return NextResponse.json({
      response: aiResponse,
      hasFDAData: true,
      fdaData: openFDAResponse
    });

  } catch (error) {
    console.error('Error generating response:', error);
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    );
  }
}
```

### 6. API Route: Query History (`src/app/api/queries/route.ts`)

```typescript
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('queries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    return NextResponse.json({ queries: data });
  } catch (error) {
    console.error('Error fetching queries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch queries' },
      { status: 500 }
    );
  }
}
```

### 7. Tailwind Configuration (`tailwind.config.ts`)

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#0a0a0a', // off-black
          secondary: '#111111',
        },
        foreground: '#fafafa',
        muted: {
          DEFAULT: '#262626',
          foreground: '#a3a3a3',
        },
        accent: {
          DEFAULT: '#6366f1', // indigo
          foreground: '#fafafa',
        },
        border: '#262626',
      },
    },
  },
  plugins: [],
}
export default config
```

### 8. Global Styles (`src/app/globals.css`)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 10 10 10;
  --foreground: 250 250 250;
  --muted: 38 38 38;
  --muted-foreground: 163 163 163;
  --accent: 99 102 241;
  --accent-foreground: 250 250 250;
  --border: 38 38 38;
}

* {
  border-color: hsl(var(--border));
}

body {
  color: hsl(var(--foreground));
  background: hsl(var(--background));
  font-feature-settings: "rlig" 1, "calt" 1;
}
```

## Usage Instructions

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Configure your environment variables** in `.env.local`

3. **Set up your Supabase database** using the provided SQL schema

4. **Test the application**:
   - Navigate to `http://localhost:3000`
   - Enter a medication question (e.g., "What are the side effects of aspirin?")
   - View the AI-generated response based on FDA data
   - Check the sidebar for query history

## Deployment

### Vercel Deployment
1. Push your code to a Git repository
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Environment Variables for Production
Ensure all environment variables are properly set in your production environment, particularly:
- Database connection strings
- API keys
- CORS settings if needed

## API Rate Limits & Considerations

- **OpenFDA**: 240 requests/minute with API key, 40 without
- **OpenAI**: Depends on your plan
- **Supabase**: Based on your tier

## Security Notes

- Never expose API keys in client-side code
- Use Supabase RLS (Row Level Security) policies as needed
- Validate all inputs on the server side
- Consider implementing rate limiting for your API routes

## Troubleshooting

### Common Issues:
1. **OpenFDA returns no results**: Try different medication name variations
2. **OpenAI API errors**: Check API key and usage limits
3. **Supabase connection issues**: Verify environment variables
4. **Build errors**: Ensure all dependencies are installed

### Debugging Tips:
- Check browser console for client-side errors
- Review server logs for API route issues
- Test OpenFDA queries directly in browser first
- Verify Supabase queries in the dashboard

This implementation provides a robust, scalable foundation for your OpenFDA medication query application with proper error handling, database integration, and a modern UI.