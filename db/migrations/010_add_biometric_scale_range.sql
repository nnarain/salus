ALTER TABLE biometrics
  ADD COLUMN scale_min DECIMAL(10, 2),
  ADD COLUMN scale_max DECIMAL(10, 2),
  ADD CONSTRAINT biometrics_scale_range_pair CHECK (
    (scale_min IS NULL AND scale_max IS NULL)
    OR (
      scale_min IS NOT NULL
      AND scale_max IS NOT NULL
      AND scale_min < scale_max
      AND value >= scale_min
      AND value <= scale_max
    )
  );

COMMENT ON COLUMN biometrics.scale_min IS 'Optional lower bound for device-specific metric scales';
COMMENT ON COLUMN biometrics.scale_max IS 'Optional upper bound for device-specific metric scales';