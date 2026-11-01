CREATE TABLE IF NOT EXISTS nutrition_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date DATE NOT NULL UNIQUE,
  calories_kcal INTEGER NOT NULL CHECK (calories_kcal >= 0),
  protein_grams NUMERIC(8, 2) NOT NULL CHECK (protein_grams >= 0),
  water_ml INTEGER NOT NULL CHECK (water_ml >= 0),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_nutrition_entries_date ON nutrition_entries(date DESC);

COMMENT ON TABLE nutrition_entries IS 'Stores daily nutrition totals';
COMMENT ON COLUMN nutrition_entries.calories_kcal IS 'Daily energy intake in kilocalories';
COMMENT ON COLUMN nutrition_entries.protein_grams IS 'Daily protein intake in grams';
COMMENT ON COLUMN nutrition_entries.water_ml IS 'Daily water intake in milliliters';