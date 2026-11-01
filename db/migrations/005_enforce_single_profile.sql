ALTER TABLE user_profile
  ADD COLUMN singleton BOOLEAN NOT NULL DEFAULT TRUE,
  ADD CONSTRAINT user_profile_singleton_true CHECK (singleton),
  ADD CONSTRAINT user_profile_singleton_unique UNIQUE (singleton);