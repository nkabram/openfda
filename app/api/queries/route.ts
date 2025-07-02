import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables:', {
    url: !!supabaseUrl,
    key: !!supabaseKey
  })
}

const supabase = createClient(supabaseUrl!, supabaseKey!)

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('fda_queries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching queries:', error)
      return NextResponse.json(
        { error: 'Failed to fetch queries' },
        { status: 500 }
      )
    }

    return NextResponse.json({ queries: data || [] })
  } catch (error) {
    console.error('Error in queries GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userQuery, extractedMedication, openfdaResponse, aiResponse } = await request.json()

    if (!userQuery || !aiResponse) {
      return NextResponse.json(
        { error: 'userQuery and aiResponse are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('fda_queries')
      .insert([
        {
          user_id: null, // No authentication yet
          user_query: userQuery,
          medication_name: extractedMedication,
          fda_response: openfdaResponse,
          ai_response: aiResponse,
        }
      ])
      .select()

    if (error) {
      console.error('Error saving query:', error)
      return NextResponse.json(
        { error: 'Failed to save query' },
        { status: 500 }
      )
    }

    return NextResponse.json({ query: data[0] })
  } catch (error) {
    console.error('Error in queries POST:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
