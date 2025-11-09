-- Create user_profile table for storing user settings like height and age
-- This table stores relatively static user information

CREATE TABLE IF NOT EXISTS user_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  height DECIMAL(10, 2),
  height_unit VARCHAR(20),
  age INTEGER,
  notes TEXT
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_profile_updated ON user_profile(updated_at DESC);

-- Add comment to the table
COMMENT ON TABLE user_profile IS 'Stores user profile settings like height and age';

-- Add comments to columns
COMMENT ON COLUMN user_profile.height IS 'User height value';
COMMENT ON COLUMN user_profile.height_unit IS 'Unit of height measurement (e.g., cm, inches, feet)';
COMMENT ON COLUMN user_profile.age IS 'User age in years';
