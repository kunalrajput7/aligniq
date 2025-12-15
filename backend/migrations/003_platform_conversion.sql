-- =====================================================
-- PLATFORM CONVERSION MIGRATION
-- Run this SQL in Supabase SQL Editor
-- =====================================================

-- 1. Add username to profiles (if not exists)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username text UNIQUE;

-- 2. Create projects table
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

-- 3. Add project_id to meetings table (nullable for direct meetings)
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;

-- 4. Add timeline_json to meetings table for storing timeline data
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS timeline_json jsonb;

-- 5. Enable RLS on projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies for projects
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Users can view own projects" ON projects;
  DROP POLICY IF EXISTS "Users can insert own projects" ON projects;
  DROP POLICY IF EXISTS "Users can update own projects" ON projects;
  DROP POLICY IF EXISTS "Users can delete own projects" ON projects;
  
  -- Create new policies
  CREATE POLICY "Users can view own projects" ON projects 
    FOR SELECT USING (auth.uid() = user_id);
  CREATE POLICY "Users can insert own projects" ON projects 
    FOR INSERT WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "Users can update own projects" ON projects 
    FOR UPDATE USING (auth.uid() = user_id);
  CREATE POLICY "Users can delete own projects" ON projects 
    FOR DELETE USING (auth.uid() = user_id);
END $$;

-- 7. Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 8. Create trigger for projects updated_at
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 9. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_meetings_project_id ON meetings(project_id);
CREATE INDEX IF NOT EXISTS idx_meetings_user_id ON meetings(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

-- 10. Ensure meeting_summaries can be inserted by users
DO $$
BEGIN
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
END $$;

-- =====================================================
-- VERIFICATION QUERIES (Run after migration)
-- =====================================================
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'profiles';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'projects';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'meetings';
