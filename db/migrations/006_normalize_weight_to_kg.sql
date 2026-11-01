UPDATE biometrics
SET value = value * 0.45359237,
    unit = 'kg'
WHERE metric_type = 'weight'
  AND LOWER(BTRIM(unit)) IN ('lb', 'lbs', 'pound', 'pounds');

UPDATE biometrics
SET unit = 'kg'
WHERE metric_type = 'weight'
  AND LOWER(BTRIM(unit)) = 'kg';