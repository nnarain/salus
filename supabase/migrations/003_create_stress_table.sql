-- Create stress table for tracking stress levels
-- This table stores stress level tracking data with a simple ranking system

CREATE TABLE IF NOT EXISTS stress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date DATE NOT NULL,
  stress_level INTEGER NOT NULL CHECK (stress_level >= 1 AND stress_level <= 10),
  notes TEXT
);

-- Create index for faster queries by date
CREATE INDEX IF NOT EXISTS idx_stress_date ON stress(date DESC);

-- Add comment to the table
COMMENT ON TABLE stress IS 'Stores stress level tracking data with simple ranking system';

-- Add comments to columns
COMMENT ON COLUMN stress.stress_level IS 'Stress level on a scale of 1-10 (1=very low, 10=very high)';
COMMENT ON COLUMN stress.notes IS 'Optional notes about the stress level or contributing factors';
