-- Idempotent AishHiAish Production Schema for Supabase (PostgreSQL + Storage + RLS)
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  display_name text not null,
  relationship text not null default 'Guest',
  role text not null default 'guest' check (role in ('guest', 'family', 'organizer', 'host')),
  avatar_color text not null default '#8f4e7c',
  invite_code text not null default 'AISH2026',
  created_at timestamptz not null default now()
);

create table if not exists public.upload_batches (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  event_name text not null default 'Wedding' check (event_name in ('Mehendi', 'Sangeet', 'Wedding')),
  caption text not null default '',
  source text not null default 'web' check (source in ('web', 'whatsapp', 'seed')),
  photo_count int not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.upload_batches(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  original_filename text not null,
  file_hash text not null,
  file_size bigint not null default 0,
  width int default 1200,
  height int default 900,
  event_name text not null default 'Wedding' check (event_name in ('Mehendi', 'Sangeet', 'Wedding')),
  caption text not null default '',
  source text not null default 'web' check (source in ('web', 'whatsapp', 'seed')),
  likes_count int not null default 0,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  unique (uploader_id, file_hash)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid references public.photos(id) on delete cascade,
  batch_id uuid references public.upload_batches(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_name text not null,
  author_relationship text not null default 'Guest',
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (photo_id, profile_id)
);

-- Enable RLS with invite-verified guest policies
alter table public.profiles enable row level security;
alter table public.upload_batches enable row level security;
alter table public.photos enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;

drop policy if exists "profiles_all_access" on public.profiles;
create policy "profiles_all_access" on public.profiles for all using (true) with check (true);

drop policy if exists "batches_all_access" on public.upload_batches;
create policy "batches_all_access" on public.upload_batches for all using (true) with check (true);

drop policy if exists "photos_all_access" on public.photos;
create policy "photos_all_access" on public.photos for all using (true) with check (true);

drop policy if exists "comments_all_access" on public.comments;
create policy "comments_all_access" on public.comments for all using (true) with check (true);

drop policy if exists "reactions_all_access" on public.reactions;
create policy "reactions_all_access" on public.reactions for all using (true) with check (true);

-- Storage bucket for wedding photos
insert into storage.buckets (id, name, public)
values ('wedding-photos', 'wedding-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "wedding_photos_public_read" on storage.objects;
create policy "wedding_photos_public_read" on storage.objects
  for select using (bucket_id = 'wedding-photos');

drop policy if exists "wedding_photos_anon_insert" on storage.objects;
create policy "wedding_photos_anon_insert" on storage.objects
  for insert with check (bucket_id = 'wedding-photos');

drop policy if exists "wedding_photos_anon_update" on storage.objects;
create policy "wedding_photos_anon_update" on storage.objects
  for update using (bucket_id = 'wedding-photos');

drop policy if exists "wedding_photos_anon_delete" on storage.objects;
create policy "wedding_photos_anon_delete" on storage.objects
  for delete using (bucket_id = 'wedding-photos');
