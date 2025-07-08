-- Add FDA data storage to fda_queries table
ALTER TABLE fda_queries ADD COLUMN IF NOT EXISTS fda_raw_data JSONB;
ALTER TABLE fda_queries ADD COLUMN IF NOT EXISTS fda_sections_used TEXT[];
ALTER TABLE fda_queries ADD COLUMN IF NOT EXISTS detected_intents TEXT[];

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_fda_queries_fda_sections ON fda_queries USING GIN (fda_sections_used);
CREATE INDEX IF NOT EXISTS idx_fda_queries_intents ON fda_queries USING GIN (detected_intents);

-- Add follow-up mode tracking to messages table
ALTER TABLE fda_messages ADD COLUMN IF NOT EXISTS follow_up_mode VARCHAR(20) DEFAULT 'fda_docs' CHECK (follow_up_mode IN ('fda_docs', 'websearch', 'llm_only'));
ALTER TABLE fda_messages ADD COLUMN IF NOT EXISTS citations JSONB;

-- Create index for follow-up mode
CREATE INDEX IF NOT EXISTS idx_fda_messages_follow_up_mode ON fda_messages(follow_up_mode);

-- Update the existing queries to have default values for new columns
UPDATE fda_queries 
SET 
  fda_sections_used = COALESCE(fda_sections_used, ARRAY[]::TEXT[]),
  detected_intents = COALESCE(detected_intents, ARRAY[]::TEXT[])
WHERE fda_sections_used IS NULL OR detected_intents IS NULL;
