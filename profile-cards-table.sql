-- Create profile_cards table for admin/owner profile cards
CREATE TABLE IF NOT EXISTS profile_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  video_url TEXT,
  theme TEXT DEFAULT 'dark',
  background_color TEXT DEFAULT '#0a0a0a',
  text_color TEXT DEFAULT '#ffffff',
  accent_color TEXT DEFAULT '#7c3aed',
  social_links JSONB DEFAULT '[]'::jsonb,
  bio TEXT,
  badge TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profile_cards ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own profile card
CREATE POLICY "Users can view own profile card"
  ON profile_cards FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to insert/update their own profile card (admin/owner only enforced in app)
CREATE POLICY "Users can insert own profile card"
  ON profile_cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own profile card
CREATE POLICY "Users can update own profile card"
  ON profile_cards FOR UPDATE
  USING (auth.uid() = user_id);

-- Allow public read access for the viewer page
CREATE POLICY "Public can view profile cards"
  ON profile_cards FOR SELECT
  USING (enabled = true);

-- Create index on username for fast lookups
CREATE INDEX idx_profile_cards_username ON profile_cards(username);
