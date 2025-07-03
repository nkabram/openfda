-- Create messages table for follow-up questions and answers
CREATE TABLE IF NOT EXISTS fda_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    query_id UUID NOT NULL REFERENCES fda_queries(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('question', 'answer')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_fda_messages_query_id ON fda_messages(query_id);
CREATE INDEX IF NOT EXISTS idx_fda_messages_created_at ON fda_messages(created_at);

-- Add RLS policies (if using Row Level Security)
ALTER TABLE fda_messages ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read their own messages
CREATE POLICY "Users can read their own messages" ON fda_messages
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- Policy for authenticated users to insert their own messages
CREATE POLICY "Users can insert their own messages" ON fda_messages
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_fda_messages_updated_at 
    BEFORE UPDATE ON fda_messages 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add a field to connect messages to original query
-- This adds a message_count to the original queries table for easy reference
ALTER TABLE fda_queries ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0;

-- Create function to update message count
CREATE OR REPLACE FUNCTION update_query_message_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE fda_queries 
        SET message_count = message_count + 1 
        WHERE id = NEW.query_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE fda_queries 
        SET message_count = message_count - 1 
        WHERE id = OLD.query_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update message count
CREATE TRIGGER update_query_message_count_trigger
    AFTER INSERT OR DELETE ON fda_messages
    FOR EACH ROW EXECUTE FUNCTION update_query_message_count();

-- Update existing fda_queries table to ensure user_id is properly set up
-- Add user_id column if it doesn't exist
ALTER TABLE fda_queries ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add RLS policies for fda_queries table
ALTER TABLE fda_queries ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read their own queries
CREATE POLICY "Users can read their own queries" ON fda_queries
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- Policy for authenticated users to insert their own queries
CREATE POLICY "Users can insert their own queries" ON fda_queries
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Policy for authenticated users to update their own queries
CREATE POLICY "Users can update their own queries" ON fda_queries
    FOR UPDATE USING (auth.uid() = user_id);

-- Create index for efficient querying by user
CREATE INDEX IF NOT EXISTS idx_fda_queries_user_id ON fda_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_fda_queries_user_created_at ON fda_queries(user_id, created_at);
