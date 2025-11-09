-- Create biometrics table for storing health measurements
-- This table is designed to be extensible for various biometric data types

CREATE TABLE IF NOT EXISTS biometrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date DATE NOT NULL,
  metric_type VARCHAR(50) NOT NULL,
  value DECIMAL(10, 2) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  notes TEXT
);

-- Create index for faster queries by date
CREATE INDEX IF NOT EXISTS idx_biometrics_date ON biometrics(date DESC);

-- Create index for faster queries by metric type
CREATE INDEX IF NOT EXISTS idx_biometrics_metric_type ON biometrics(metric_type);

-- Add comment to the table
COMMENT ON TABLE biometrics IS 'Stores various biometric measurements like weight, waistline, etc.';

-- Add comments to columns
COMMENT ON COLUMN biometrics.metric_type IS 'Type of biometric measurement (e.g., weight, waistline)';
COMMENT ON COLUMN biometrics.value IS 'Numeric value of the measurement';
COMMENT ON COLUMN biometrics.unit IS 'Unit of measurement (e.g., kg, lbs, cm, inches)';
