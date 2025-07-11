import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: Request) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 })
    }

    // Create service role client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the user's token and get their user data
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Check if user is admin
    const { data: adminData, error: adminError } = await supabase
      .from('admins')
      .select('is_admin')
      .eq('user_id', user.id)
      .single()

    if (adminError || !adminData?.is_admin) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 })
    }

    // Fetch trusted domains
    const { data: domains, error: domainsError } = await supabase
      .from('trusted_domains')
      .select('*')
      .order('domain', { ascending: true })

    if (domainsError) {
      console.error('Error fetching trusted domains:', domainsError)
      return NextResponse.json({ error: 'Failed to fetch trusted domains' }, { status: 500 })
    }

    return NextResponse.json({ domains })
  } catch (error) {
    console.error('Error in trusted domains GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 })
    }

    // Create service role client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the user's token and get their user data
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Check if user is admin
    const { data: adminData, error: adminError } = await supabase
      .from('admins')
      .select('is_admin')
      .eq('user_id', user.id)
      .single()

    if (adminError || !adminData?.is_admin) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { domain } = body

    if (!domain || typeof domain !== 'string') {
      return NextResponse.json({ error: 'Invalid domain' }, { status: 400 })
    }

    // Add the domain
    const { data, error } = await supabase
      .from('trusted_domains')
      .insert({ 
        domain: domain.toLowerCase().trim(),
        created_by: user.id 
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') { // Unique violation
        return NextResponse.json({ error: 'Domain already exists' }, { status: 409 })
      }
      console.error('Error adding trusted domain:', error)
      return NextResponse.json({ error: 'Failed to add trusted domain' }, { status: 500 })
    }

    return NextResponse.json({ domain: data })
  } catch (error) {
    console.error('Error in trusted domains POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 })
    }

    // Create service role client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the user's token and get their user data
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Check if user is admin
    const { data: adminData, error: adminError } = await supabase
      .from('admins')
      .select('is_admin')
      .eq('user_id', user.id)
      .single()

    if (adminError || !adminData?.is_admin) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Domain ID required' }, { status: 400 })
    }

    // Delete the domain
    const { error } = await supabase
      .from('trusted_domains')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting trusted domain:', error)
      return NextResponse.json({ error: 'Failed to delete trusted domain' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in trusted domains DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
