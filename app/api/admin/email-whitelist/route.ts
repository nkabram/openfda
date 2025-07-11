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

    // Fetch email whitelist
    const { data: emails, error: emailsError } = await supabase
      .from('email_whitelist')
      .select('*')
      .order('email', { ascending: true })

    if (emailsError) {
      console.error('Error fetching email whitelist:', emailsError)
      return NextResponse.json({ error: 'Failed to fetch email whitelist' }, { status: 500 })
    }

    return NextResponse.json({ emails })
  } catch (error) {
    console.error('Error in email whitelist GET:', error)
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
    const { email } = body

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }

    // Add the email
    const { data, error } = await supabase
      .from('email_whitelist')
      .insert({ 
        email: email.toLowerCase().trim(),
        created_by: user.id 
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') { // Unique violation
        return NextResponse.json({ error: 'Email already exists' }, { status: 409 })
      }
      console.error('Error adding email to whitelist:', error)
      return NextResponse.json({ error: 'Failed to add email to whitelist' }, { status: 500 })
    }

    return NextResponse.json({ email: data })
  } catch (error) {
    console.error('Error in email whitelist POST:', error)
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
      return NextResponse.json({ error: 'Email ID required' }, { status: 400 })
    }

    // Delete the email
    const { error } = await supabase
      .from('email_whitelist')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting email from whitelist:', error)
      return NextResponse.json({ error: 'Failed to delete email from whitelist' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in email whitelist DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
