-- =====================================================
-- COLLABORATION FEATURE - DATABASE MIGRATION
-- =====================================================
-- Run this SQL in Supabase SQL Editor AFTER 000_complete_fresh_setup.sql
-- This adds project collaboration (sharing projects with other users)
-- Date: December 17, 2024
-- =====================================================

-- =====================================================
-- 1. PROJECT COLLABORATORS TABLE
-- =====================================================
-- Many-to-many relationship between users and projects
-- Allows multiple users to access the same project

CREATE TABLE IF NOT EXISTS project_collaborators (
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES profiles(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id)
);

-- Enable RLS on project_collaborators
ALTER TABLE project_collaborators ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. PROJECT COLLABORATORS RLS POLICIES
-- =====================================================

-- Users can view collaborators for projects they own or are part of
DROP POLICY IF EXISTS "Users can view project collaborators" ON project_collaborators;
CREATE POLICY "Users can view project collaborators" ON project_collaborators
  FOR SELECT USING (
    -- Project owner can see collaborators
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND user_id = auth.uid())
    OR
    -- Collaborators can see other collaborators
    user_id = auth.uid()
  );

-- Only project owners can add collaborators
DROP POLICY IF EXISTS "Project owners can add collaborators" ON project_collaborators;
CREATE POLICY "Project owners can add collaborators" ON project_collaborators
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND user_id = auth.uid())
  );

-- Only project owners can remove collaborators
DROP POLICY IF EXISTS "Project owners can remove collaborators" ON project_collaborators;
CREATE POLICY "Project owners can remove collaborators" ON project_collaborators
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND user_id = auth.uid())
  );

-- =====================================================
-- 3. UPDATE PROJECTS RLS POLICIES (Additive - keeps existing functionality)
-- =====================================================

-- Drop old policy and recreate with collaboration support
DROP POLICY IF EXISTS "Users can view own projects" ON projects;
CREATE POLICY "Users can view own or shared projects" ON projects
  FOR SELECT USING (
    auth.uid() = user_id  -- Owner
    OR
    EXISTS (  -- Collaborator
      SELECT 1 FROM project_collaborators pc
      WHERE pc.project_id = id AND pc.user_id = auth.uid()
    )
  );

-- Keep insert policy (only owners create projects)
-- Already exists: "Users can insert own projects"

-- Update policy - both owner and collaborators can update
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
CREATE POLICY "Users can update own or shared projects" ON projects
  FOR UPDATE USING (
    auth.uid() = user_id  -- Owner
    OR
    EXISTS (
      SELECT 1 FROM project_collaborators pc
      WHERE pc.project_id = id AND pc.user_id = auth.uid()
    )
  );

-- Keep delete policy (only owners can delete projects)
-- Already exists: "Users can delete own projects"

-- =====================================================
-- 4. UPDATE MEETINGS RLS POLICIES
-- =====================================================

-- Drop old policy and recreate with collaboration support
DROP POLICY IF EXISTS "Users can view own meetings" ON meetings;
CREATE POLICY "Users can view own or shared meetings" ON meetings
  FOR SELECT USING (
    auth.uid() = user_id  -- Owner
    OR
    EXISTS (  -- Collaborator on the project
      SELECT 1 FROM project_collaborators pc
      WHERE pc.project_id = meetings.project_id AND pc.user_id = auth.uid()
    )
  );

-- Update insert policy - collaborators can add meetings to shared projects
DROP POLICY IF EXISTS "Users can insert own meetings" ON meetings;
CREATE POLICY "Users can insert own or shared meetings" ON meetings
  FOR INSERT WITH CHECK (
    auth.uid() = user_id  -- Own meeting
    OR
    EXISTS (  -- Adding to a shared project
      SELECT 1 FROM project_collaborators pc
      WHERE pc.project_id = meetings.project_id AND pc.user_id = auth.uid()
    )
  );

-- Update policy - both owner and collaborators can update
DROP POLICY IF EXISTS "Users can update own meetings" ON meetings;
CREATE POLICY "Users can update own or shared meetings" ON meetings
  FOR UPDATE USING (
    auth.uid() = user_id  -- Owner
    OR
    EXISTS (
      SELECT 1 FROM project_collaborators pc
      WHERE pc.project_id = meetings.project_id AND pc.user_id = auth.uid()
    )
  );

-- Update delete policy - both owner and collaborators can delete
DROP POLICY IF EXISTS "Users can delete own meetings" ON meetings;
CREATE POLICY "Users can delete own or shared meetings" ON meetings
  FOR DELETE USING (
    auth.uid() = user_id  -- Owner
    OR
    EXISTS (
      SELECT 1 FROM project_collaborators pc
      WHERE pc.project_id = meetings.project_id AND pc.user_id = auth.uid()
    )
  );

-- =====================================================
-- 5. UPDATE MEETING SUMMARIES RLS POLICIES
-- =====================================================

-- Drop old policy and recreate with collaboration support
DROP POLICY IF EXISTS "Users can view own summaries" ON meeting_summaries;
CREATE POLICY "Users can view own or shared summaries" ON meeting_summaries
  FOR SELECT USING (
    auth.uid() = (SELECT user_id FROM meetings WHERE id = meeting_id)
    OR
    EXISTS (
      SELECT 1 FROM meetings m
      JOIN project_collaborators pc ON pc.project_id = m.project_id
      WHERE m.id = meeting_id AND pc.user_id = auth.uid()
    )
  );

-- Summaries are created by backend (service_role), so we keep existing insert policy
-- Already exists: "Users can insert own summaries"

-- Also allow backend inserts (service role) - keep existing
DROP POLICY IF EXISTS "Backend can insert summaries" ON meeting_summaries;
CREATE POLICY "Backend can insert summaries" ON meeting_summaries
  FOR INSERT WITH CHECK (true);

-- Update policy for summaries
DROP POLICY IF EXISTS "Users can update own summaries" ON meeting_summaries;
CREATE POLICY "Users can update own or shared summaries" ON meeting_summaries
  FOR UPDATE USING (
    auth.uid() = (SELECT user_id FROM meetings WHERE id = meeting_id)
    OR
    EXISTS (
      SELECT 1 FROM meetings m
      JOIN project_collaborators pc ON pc.project_id = m.project_id
      WHERE m.id = meeting_id AND pc.user_id = auth.uid()
    )
  );

-- Delete policy for summaries
DROP POLICY IF EXISTS "Users can delete own summaries" ON meeting_summaries;
CREATE POLICY "Users can delete own or shared summaries" ON meeting_summaries
  FOR DELETE USING (
    auth.uid() = (SELECT user_id FROM meetings WHERE id = meeting_id)
    OR
    EXISTS (
      SELECT 1 FROM meetings m
      JOIN project_collaborators pc ON pc.project_id = m.project_id
      WHERE m.id = meeting_id AND pc.user_id = auth.uid()
    )
  );

-- =====================================================
-- 6. INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_project_collaborators_project_id ON project_collaborators(project_id);
CREATE INDEX IF NOT EXISTS idx_project_collaborators_user_id ON project_collaborators(user_id);

-- =====================================================
-- 7. ENABLE REALTIME FOR COLLABORATORS
-- =====================================================

-- Enable realtime on project_collaborators table
ALTER PUBLICATION supabase_realtime ADD TABLE project_collaborators;

-- =====================================================
-- VERIFICATION QUERIES (Run after migration to verify)
-- =====================================================
-- 
-- Check table exists:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'project_collaborators' ORDER BY ordinal_position;
--
-- Check RLS policies:
-- SELECT tablename, policyname FROM pg_policies 
-- WHERE schemaname = 'public' AND tablename IN ('projects', 'meetings', 'meeting_summaries', 'project_collaborators');
--
-- =====================================================
-- MIGRATION COMPLETE!
-- =====================================================
