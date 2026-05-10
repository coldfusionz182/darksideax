-- Add NEW columns only (old ones already exist)
-- If you get "column already exists" errors, run only the lines that fail

-- NEW: Audio cover image
ALTER TABLE profile_cards ADD COLUMN IF NOT EXISTS audio_cover TEXT;

-- NEW: Profile effects
ALTER TABLE profile_cards ADD COLUMN IF NOT EXISTS profile_layout TEXT DEFAULT 'default';
ALTER TABLE profile_cards ADD COLUMN IF NOT EXISTS enable_typewriter BOOLEAN DEFAULT false;
ALTER TABLE profile_cards ADD COLUMN IF NOT EXISTS enable_particles BOOLEAN DEFAULT false;
ALTER TABLE profile_cards ADD COLUMN IF NOT EXISTS enable_glitch BOOLEAN DEFAULT false;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profile_cards_profile_layout ON profile_cards(profile_layout);
