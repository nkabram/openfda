-- Add citations support to the database
-- This script adds the ability to store web search citations for follow-up responses

-- Option 1: Add citations as JSONB column to existing fda_messages table
-- This is simpler and works well for most use cases
ALTER TABLE fda_messages ADD COLUMN IF NOT EXISTS citations JSONB;

-- Add index for efficient citation queries
CREATE INDEX IF NOT EXISTS idx_fda_messages_citations ON fda_messages USING GIN (citations);

-- Add websearch_enabled flag to track which responses used websearch
ALTER TABLE fda_messages ADD COLUMN IF NOT EXISTS websearch_enabled BOOLEAN DEFAULT FALSE;

-- Option 2: Create separate citations table for normalized storage (optional, more complex)
-- Uncomment if you prefer normalized approach:

/*
CREATE TABLE IF NOT EXISTS fda_citations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES fda_messages(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    snippet TEXT,
    display_url TEXT,
    position INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_fda_citations_message_id ON fda_citations(message_id);
CREATE INDEX IF NOT EXISTS idx_fda_citations_url ON fda_citations(url);

-- Add RLS policies for citations table
ALTER TABLE fda_citations ENABLE ROW LEVEL SECURITY;

-- Policy for users to read citations for their messages
CREATE POLICY "Users can read citations for their messages" ON fda_citations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM fda_messages fm 
            WHERE fm.id = fda_citations.message_id 
            AND (fm.user_id = auth.uid() OR fm.user_id IS NULL)
        )
    );

-- Policy for users to insert citations for their messages
CREATE POLICY "Users can insert citations for their messages" ON fda_citations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM fda_messages fm 
            WHERE fm.id = fda_citations.message_id 
            AND (fm.user_id = auth.uid() OR fm.user_id IS NULL)
        )
    );
*/

-- Update existing messages to have websearch_enabled = false by default
UPDATE fda_messages SET websearch_enabled = FALSE WHERE websearch_enabled IS NULL;

-- Add comment to document the citations JSONB structure
COMMENT ON COLUMN fda_messages.citations IS 'JSONB array of citation objects with structure: [{"title": "string", "url": "string", "snippet": "string", "display_url": "string", "position": number}]';

COMMENT ON COLUMN fda_messages.websearch_enabled IS 'Boolean flag indicating whether this message response was generated using web search';
