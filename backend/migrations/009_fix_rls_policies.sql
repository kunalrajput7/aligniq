-- =====================================================
-- FIX: INFINITE RECURSION IN RLS POLICIES
-- =====================================================
-- The issue: project_collaborators policy references projects,
-- and projects policy references project_collaborators = INFINITE LOOP!
--
-- Solution: Simplify project_collaborators policies to NOT reference projects table
-- =====================================================

-- =====================================================
-- 1. FIX PROJECT_COLLABORATORS POLICIES
-- =====================================================
-- Remove the circular reference by only checking user_id directly

DROP POLICY IF EXISTS "Users can view project collaborators" ON project_collaborators;
CREATE POLICY "Users can view project collaborators" ON project_collaborators
  FOR SELECT USING (
    -- User can see rows where they are the collaborator
    user_id = auth.uid()
    OR
    -- User can see rows where they invited someone
    invited_by = auth.uid()
  );

-- Insert policy - use SECURITY DEFINER function instead of policy check
DROP POLICY IF EXISTS "Project owners can add collaborators" ON project_collaborators;
CREATE POLICY "Project owners can add collaborators" ON project_collaborators
  FOR INSERT WITH CHECK (
    -- User is the one doing the invite
    invited_by = auth.uid()
  );

-- Delete policy - owners or the collaborator themselves can remove
DROP POLICY IF EXISTS "Project owners can remove collaborators" ON project_collaborators;
CREATE POLICY "Project owners can remove collaborators" ON project_collaborators
  FOR DELETE USING (
    -- User can delete rows where they are the collaborator (leave project)
    user_id = auth.uid()
    OR
    -- User can delete rows where they invited someone (owner removes)
    invited_by = auth.uid()
  );

-- =====================================================
-- VERIFICATION: Run this to confirm policies are fixed
-- =====================================================
-- SELECT tablename, policyname, cmd FROM pg_policies 
-- WHERE schemaname = 'public' AND tablename = 'project_collaborators';
--
-- Then refresh your frontend - data should appear!
-- =====================================================
