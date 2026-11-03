ALTER TABLE nutrition_entries
  DROP CONSTRAINT IF EXISTS nutrition_entries_date_key,
  ALTER COLUMN calories_kcal DROP NOT NULL,
  ALTER COLUMN protein_grams DROP NOT NULL,
  ALTER COLUMN water_ml DROP NOT NULL,
  ADD COLUMN estimated BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN partial BOOLEAN NOT NULL DEFAULT FALSE,
  ADD CONSTRAINT nutrition_entries_has_values CHECK (
    calories_kcal IS NOT NULL OR protein_grams IS NOT NULL OR water_ml IS NOT NULL
  );

COMMENT ON COLUMN nutrition_entries.estimated IS 'Whether this entry contains estimated rather than measured values';
COMMENT ON COLUMN nutrition_entries.partial IS 'Whether this entry represents an incomplete day of nutrition data';