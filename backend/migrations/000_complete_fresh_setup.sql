-- =====================================================
-- SUMMAR AI - COMPLETE FRESH DATABASE SETUP
-- =====================================================
-- Run this SQL in Supabase SQL Editor to set up the entire database from scratch.
-- This combines all migrations into a single file for fresh installs.
-- Date: December 17, 2024
-- =====================================================

-- Enable UUID extension (usually already enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. PROFILES TABLE (User profiles, linked to auth.users)
-- =====================================================

CREATE TABLE IF NOT EXISTS profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email text,
  full_name text,
  username text UNIQUE,
  avatar_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON profiles 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile." ON profiles;
CREATE POLICY "Users can insert their own profile." ON profiles 
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile." ON profiles;
CREATE POLICY "Users can update own profile." ON profiles 
  FOR UPDATE USING (auth.uid() = id);

-- =====================================================
-- 2. AUTO-CREATE PROFILE ON USER SIGNUP
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =====================================================
-- 3. PROJECTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS projects (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  status text DEFAULT 'active', -- active, completed, archived
  deadline date,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Projects policies
DROP POLICY IF EXISTS "Users can view own projects" ON projects;
CREATE POLICY "Users can view own projects" ON projects 
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own projects" ON projects;
CREATE POLICY "Users can insert own projects" ON projects 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own projects" ON projects;
CREATE POLICY "Users can update own projects" ON projects 
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own projects" ON projects;
CREATE POLICY "Users can delete own projects" ON projects 
  FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 4. MEETINGS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS meetings (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL, -- NULL for direct meetings
  title text NOT NULL,
  date date,
  duration_ms integer DEFAULT 0,
  participants text[] DEFAULT '{}',
  status text DEFAULT 'processing', -- processing, completed, failed
  timeline_json jsonb, -- Timeline data from Stage 1
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on meetings
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- Meetings policies
DROP POLICY IF EXISTS "Users can view own meetings" ON meetings;
CREATE POLICY "Users can view own meetings" ON meetings 
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own meetings" ON meetings;
CREATE POLICY "Users can insert own meetings" ON meetings 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own meetings" ON meetings;
CREATE POLICY "Users can update own meetings" ON meetings 
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own meetings" ON meetings;
CREATE POLICY "Users can delete own meetings" ON meetings 
  FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 5. MEETING SUMMARIES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS meeting_summaries (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  meeting_id uuid REFERENCES meetings(id) ON DELETE CASCADE UNIQUE NOT NULL,
  summary_json jsonb, -- Contains: narrative_summary, action_items, achievements, blockers
  mindmap_json jsonb, -- Mindmap visualization data
  chapters_json jsonb, -- Chapter data with summaries
  hats_json jsonb, -- Six Thinking Hats analysis
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on meeting_summaries
ALTER TABLE meeting_summaries ENABLE ROW LEVEL SECURITY;

-- Meeting summaries policies
DROP POLICY IF EXISTS "Users can view own summaries" ON meeting_summaries;
CREATE POLICY "Users can view own summaries" ON meeting_summaries 
  FOR SELECT USING (
    auth.uid() = (SELECT user_id FROM meetings WHERE id = meeting_id)
  );

DROP POLICY IF EXISTS "Users can insert own summaries" ON meeting_summaries;
CREATE POLICY "Users can insert own summaries" ON meeting_summaries 
  FOR INSERT WITH CHECK (
    auth.uid() = (SELECT user_id FROM meetings WHERE id = meeting_id)
  );

DROP POLICY IF EXISTS "Users can update own summaries" ON meeting_summaries;
CREATE POLICY "Users can update own summaries" ON meeting_summaries 
  FOR UPDATE USING (
    auth.uid() = (SELECT user_id FROM meetings WHERE id = meeting_id)
  );

DROP POLICY IF EXISTS "Users can delete own summaries" ON meeting_summaries;
CREATE POLICY "Users can delete own summaries" ON meeting_summaries 
  FOR DELETE USING (
    auth.uid() = (SELECT user_id FROM meetings WHERE id = meeting_id)
  );

-- =====================================================
-- 6. TRIGGERS FOR updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Profiles trigger
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Projects trigger
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Meetings trigger
DROP TRIGGER IF EXISTS update_meetings_updated_at ON meetings;
CREATE TRIGGER update_meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Meeting summaries trigger
DROP TRIGGER IF EXISTS update_meeting_summaries_updated_at ON meeting_summaries;
CREATE TRIGGER update_meeting_summaries_updated_at
  BEFORE UPDATE ON meeting_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 7. INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_meetings_user_id ON meetings(user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_project_id ON meetings(project_id);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_created_at ON meetings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_summaries_meeting_id ON meeting_summaries(meeting_id);

-- =====================================================
-- 8. ENABLE REALTIME FOR NOTIFICATIONS
-- =====================================================

-- Enable realtime on meetings table (for processing notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE meetings;

-- =====================================================
-- VERIFICATION QUERIES (Run after migration to verify)
-- =====================================================
-- 
-- Table structure checks:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'profiles' ORDER BY ordinal_position;
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'projects' ORDER BY ordinal_position;
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'meetings' ORDER BY ordinal_position;
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'meeting_summaries' ORDER BY ordinal_position;
--
-- RLS policy checks:
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
--
-- Trigger checks:
-- SELECT trigger_name, event_object_table FROM information_schema.triggers WHERE trigger_schema = 'public';
--
-- =====================================================
-- SETUP COMPLETE!
-- =====================================================
