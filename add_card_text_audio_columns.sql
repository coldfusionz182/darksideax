-- Add missing text effect and audio columns to profile_cards
-- Run this after add_text_effects_columns.sql

ALTER TABLE profile_cards ADD COLUMN IF NOT EXISTS username_effect TEXT DEFAULT 'none';
ALTER TABLE profile_cards ADD COLUMN IF NOT EXISTS username_font TEXT DEFAULT 'default';
ALTER TABLE profile_cards ADD COLUMN IF NOT EXISTS badge_effect TEXT DEFAULT 'none';
ALTER TABLE profile_cards ADD COLUMN IF NOT EXISTS badge_font TEXT DEFAULT 'default';
ALTER TABLE profile_cards ADD COLUMN IF NOT EXISTS bio_effect TEXT DEFAULT 'none';
ALTER TABLE profile_cards ADD COLUMN IF NOT EXISTS bio_font TEXT DEFAULT 'default';

ALTER TABLE profile_cards ADD COLUMN IF NOT EXISTS enable_audio_player BOOLEAN DEFAULT false;
ALTER TABLE profile_cards ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE profile_cards ADD COLUMN IF NOT EXISTS audio_title TEXT DEFAULT 'Background Music';
