-- Create feedback table for collecting user feedback on responses
CREATE TABLE IF NOT EXISTS response_feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    query_id UUID REFERENCES fda_queries(id) ON DELETE CASCADE,
    message_id UUID REFERENCES fda_messages(id) ON DELETE CASCADE,
    feedback_type VARCHAR(20) NOT NULL CHECK (feedback_type IN ('thumbs_up', 'thumbs_down')),
    feedback_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints to ensure we only have one feedback per user per response
    UNIQUE(user_id, query_id, message_id),
    
    -- Either query_id or message_id must be provided (for original response or follow-up)
    CHECK (query_id IS NOT NULL OR message_id IS NOT NULL)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_response_feedback_user_id ON response_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_response_feedback_query_id ON response_feedback(query_id);
CREATE INDEX IF NOT EXISTS idx_response_feedback_message_id ON response_feedback(message_id);
CREATE INDEX IF NOT EXISTS idx_response_feedback_created_at ON response_feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_response_feedback_type ON response_feedback(feedback_type);

-- Add RLS policies
ALTER TABLE response_feedback ENABLE ROW LEVEL SECURITY;

-- Policy for users to read their own feedback
CREATE POLICY "Users can read their own feedback" ON response_feedback
    FOR SELECT USING (auth.uid() = user_id);

-- Policy for users to insert their own feedback
CREATE POLICY "Users can insert their own feedback" ON response_feedback
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy for users to update their own feedback
CREATE POLICY "Users can update their own feedback" ON response_feedback
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy for users to delete their own feedback
CREATE POLICY "Users can delete their own feedback" ON response_feedback
    FOR DELETE USING (auth.uid() = user_id);

-- Policy for admins to view all feedback
CREATE POLICY "Admins can view all feedback" ON response_feedback
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM admins 
            WHERE admins.id = auth.uid() 
            AND admins.is_admin = TRUE
        )
    );

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_feedback_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_response_feedback_updated_at 
    BEFORE UPDATE ON response_feedback 
    FOR EACH ROW EXECUTE FUNCTION update_feedback_updated_at_column();

-- Function to get feedback statistics for admins
CREATE OR REPLACE FUNCTION get_feedback_stats()
RETURNS TABLE (
    total_feedback BIGINT,
    thumbs_up_count BIGINT,
    thumbs_down_count BIGINT,
    feedback_with_text_count BIGINT,
    avg_thumbs_up_percentage NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_feedback,
        COUNT(*) FILTER (WHERE feedback_type = 'thumbs_up') as thumbs_up_count,
        COUNT(*) FILTER (WHERE feedback_type = 'thumbs_down') as thumbs_down_count,
        COUNT(*) FILTER (WHERE feedback_text IS NOT NULL AND feedback_text != '') as feedback_with_text_count,
        CASE 
            WHEN COUNT(*) > 0 THEN 
                ROUND((COUNT(*) FILTER (WHERE feedback_type = 'thumbs_up')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
            ELSE 0
        END as avg_thumbs_up_percentage
    FROM response_feedback;
END;
$$;

-- Function to get detailed feedback for a specific query (for admins)
CREATE OR REPLACE FUNCTION get_query_feedback(query_uuid UUID)
RETURNS TABLE (
    feedback_id UUID,
    user_email TEXT,
    feedback_type VARCHAR(20),
    feedback_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    is_follow_up BOOLEAN,
    message_content TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rf.id as feedback_id,
        p.email as user_email,
        rf.feedback_type,
        rf.feedback_text,
        rf.created_at,
        (rf.message_id IS NOT NULL) as is_follow_up,
        CASE 
            WHEN rf.message_id IS NOT NULL THEN m.content
            ELSE q.ai_response::TEXT
        END as message_content
    FROM response_feedback rf
    LEFT JOIN auth.users p ON rf.user_id = p.id
    LEFT JOIN fda_queries q ON rf.query_id = q.id
    LEFT JOIN fda_messages m ON rf.message_id = m.id
    WHERE rf.query_id = query_uuid OR rf.message_id IN (
        SELECT id FROM fda_messages WHERE query_id = query_uuid
    )
    ORDER BY rf.created_at DESC;
END;
$$;
