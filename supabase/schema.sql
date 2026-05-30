create extension if not exists "pgcrypto";

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  age int,
  school_name text,
  avatar_url text,
  pin_hash text,
  parent_email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists topics (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  title text not null,
  description text,
  image_url text,
  system_prompt text,
  order_index int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  subject text not null,
  topic_id uuid references topics(id),
  started_at timestamptz default now(),
  ended_at timestamptz,
  duration_min int,
  total_points int default 0,
  status text default 'active'
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz default now()
);

create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  total_points int default 0,
  sessions_count int default 0,
  topics_completed int default 0,
  updated_at timestamptz default now()
);

create table if not exists badges (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text,
  icon_url text,
  condition_type text,
  condition_value int
);

create table if not exists student_badges (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  badge_id uuid references badges(id),
  earned_at timestamptz default now()
);

create table if not exists certificates (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  session_id uuid references sessions(id),
  generated_at timestamptz default now(),
  pdf_url text,
  content_json jsonb
);
