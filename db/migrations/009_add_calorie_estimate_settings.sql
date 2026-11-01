ALTER TABLE user_profile
  ADD COLUMN biological_sex VARCHAR(10)
    CHECK (biological_sex IN ('male', 'female')),
  ADD COLUMN activity_level VARCHAR(20)
    CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  ADD COLUMN daily_calorie_target INTEGER
    CHECK (daily_calorie_target BETWEEN 1 AND 10000);