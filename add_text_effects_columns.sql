-- Add NEW columns only (old ones already exist)
-- If you get "column already exists" errors, that's okay - skip those lines

-- NEW: Audio cover image
ALTER TABLE profile_cards ADD COLUMN IF NOT EXISTS audio_cover TEXT;

-- NEW: Profile effects
ALTER TABLE profile_cards ADD COLUMN IF NOT EXISTS profile_layout TEXT DEFAULT 'default';
ALTER TABLE profile_cards ADD COLUMN IF NOT EXISTS enable_typewriter BOOLEAN DEFAULT false;
ALTER TABLE profile_cards ADD COLUMN IF NOT EXISTS enable_particles BOOLEAN DEFAULT false;
ALTER TABLE profile_cards ADD COLUMN IF NOT EXISTS enable_glitch BOOLEAN DEFAULT false;

-- NEW: Custom card avatar
ALTER TABLE profile_cards ADD COLUMN IF NOT EXISTS card_avatar_url TEXT;

-- NEW: Animated social buttons
ALTER TABLE profile_cards ADD COLUMN IF NOT EXISTS animated_social_buttons BOOLEAN DEFAULT false;

-- NEW: Audio player customization
ALTER TABLE profile_cards ADD COLUMN IF NOT EXISTS audio_player_position TEXT DEFAULT 'bottom-right';
ALTER TABLE profile_cards ADD COLUMN IF NOT EXISTS audio_player_style TEXT DEFAULT 'full';
ALTER TABLE profile_cards ADD COLUMN IF NOT EXISTS audio_player_theme TEXT DEFAULT 'accent';
ALTER TABLE profile_cards ADD COLUMN IF NOT EXISTS audio_visualizer TEXT DEFAULT 'none';
ALTER TABLE profile_cards ADD COLUMN IF NOT EXISTS audio_show_cover BOOLEAN DEFAULT true;
ALTER TABLE profile_cards ADD COLUMN IF NOT EXISTS audio_autohide BOOLEAN DEFAULT false;

-- NEW: Click to Enter text customization
ALTER TABLE profile_cards ADD COLUMN IF NOT EXISTS enter_text TEXT DEFAULT 'Click to Enter';
ALTER TABLE profile_cards ADD COLUMN IF NOT EXISTS enter_text_effect TEXT DEFAULT 'rainbow-text';
ALTER TABLE profile_cards ADD COLUMN IF NOT EXISTS enter_text_font TEXT DEFAULT 'font-cyberpunk';

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_profile_cards_profile_layout ON profile_cards(profile_layout);
