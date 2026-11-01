CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date DATE NOT NULL,
  activity_name VARCHAR(100) NOT NULL,
  activity_type VARCHAR(50) NOT NULL,
  effort_level INTEGER NOT NULL CHECK (effort_level >= 1 AND effort_level <= 10),
  duration_minutes INTEGER,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(date DESC);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_activities_name ON activities(activity_name);

COMMENT ON TABLE activities IS 'Stores activity/exercise tracking data for trend analysis';
COMMENT ON COLUMN activities.activity_name IS 'Name of the activity (e.g., running, martial arts, sports)';
COMMENT ON COLUMN activities.activity_type IS 'Type of activity (strength or cardio)';
COMMENT ON COLUMN activities.effort_level IS 'General effort level on a scale of 1-10';
COMMENT ON COLUMN activities.duration_minutes IS 'Duration of activity in minutes (optional)';