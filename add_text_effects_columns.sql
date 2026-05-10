-- Add text effects and audio columns to profile_cards table
-- Run this in your Supabase SQL editor

-- Text effect columns
ALTER TABLE profile_cards ADD COLUMN username_effect TEXT DEFAULT 'none';
ALTER TABLE profile_cards ADD COLUMN username_font TEXT DEFAULT 'default';
ALTER TABLE profile_cards ADD COLUMN badge_effect TEXT DEFAULT 'none';
ALTER TABLE profile_cards ADD COLUMN badge_font TEXT DEFAULT 'default';
ALTER TABLE profile_cards ADD COLUMN bio_effect TEXT DEFAULT 'none';
ALTER TABLE profile_cards ADD COLUMN bio_font TEXT DEFAULT 'default';

-- Audio settings columns
ALTER TABLE profile_cards ADD COLUMN enable_audio_player BOOLEAN DEFAULT false;
ALTER TABLE profile_cards ADD COLUMN audio_url TEXT;
ALTER TABLE profile_cards ADD COLUMN audio_title TEXT DEFAULT 'Background Music';

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profile_cards_username_effect ON profile_cards(username_effect);
CREATE INDEX IF NOT EXISTS idx_profile_cards_enable_audio_player ON profile_cards(enable_audio_player);
