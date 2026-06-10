-- Supabase schema for Math Survivor
-- Run these in the Supabase SQL editor or use migrations

-- User profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  total_points INTEGER DEFAULT 0,
  current_world INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Level progress tracking
CREATE TABLE level_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  world INTEGER NOT NULL,
  level INTEGER NOT NULL,
  stars INTEGER DEFAULT 0 CHECK (stars >= 0 AND stars <= 3),
  score INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(user_id, world, level)
);

-- Enable RLS (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE level_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can view their own level progress"
  ON level_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own level progress"
  ON level_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own level progress"
  ON level_progress FOR UPDATE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_level_progress_user ON level_progress(user_id);
CREATE INDEX idx_level_progress_world ON level_progress(user_id, world);
