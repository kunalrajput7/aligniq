-- Create a table for public profiles
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  avatar_url text,
  updated_at timestamp with time zone
);

-- Create a table for meetings
create table meetings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  title text,
  date timestamp with time zone,
  duration_ms integer,
  participants text[], -- Array of strings
  status text default 'processing', -- processing, completed, failed
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create a table for meeting data (JSON blobs for large data)
create table meeting_summaries (
  meeting_id uuid references meetings(id) on delete cascade primary key,
  summary_json jsonb, -- Stores the full collective summary
  mindmap_json jsonb, -- Stores the mindmap data
  chapters_json jsonb, -- Stores chapters
  hats_json jsonb -- Stores six hats analysis
);

-- Enable Row Level Security (RLS)
alter table profiles enable row level security;
alter table meetings enable row level security;
alter table meeting_summaries enable row level security;

-- Policies (Users can only see their own data)
create policy "Public profiles are viewable by everyone." on profiles for select using ( true );
create policy "Users can insert their own profile." on profiles for insert with check ( auth.uid() = id );
create policy "Users can update own profile." on profiles for update using ( auth.uid() = id );

create policy "Users can view own meetings." on meetings for select using ( auth.uid() = user_id );
create policy "Users can insert own meetings." on meetings for insert with check ( auth.uid() = user_id );
create policy "Users can delete own meetings." on meetings for delete using ( auth.uid() = user_id );

create policy "Users can view own summaries." on meeting_summaries for select using ( auth.uid() = (select user_id from meetings where id = meeting_id) );
