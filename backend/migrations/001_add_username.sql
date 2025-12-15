-- Add username column to profiles table
ALTER TABLE profiles ADD COLUMN username text UNIQUE;

-- Create a policy to allow users to update their own username
-- (This is already covered by "Users can update own profile." policy, but good to verify)
