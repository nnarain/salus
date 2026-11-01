CREATE TABLE IF NOT EXISTS sleep_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  wake_date DATE NOT NULL,
  bedtime TIME NOT NULL,
  wake_time TIME NOT NULL,
  sleep_duration_minutes INTEGER NOT NULL CHECK (sleep_duration_minutes > 0 AND sleep_duration_minutes <= 1440),
  restedness INTEGER CHECK (restedness >= 1 AND restedness <= 5),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_sleep_entries_wake_date ON sleep_entries(wake_date DESC);

COMMENT ON TABLE sleep_entries IS 'Stores sleep sessions keyed by the date the user wakes up';
COMMENT ON COLUMN sleep_entries.sleep_duration_minutes IS 'Total time asleep, recorded in minutes';
COMMENT ON COLUMN sleep_entries.restedness IS 'Optional subjective restedness rating from 1 to 5';