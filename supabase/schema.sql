create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text not null,
  cover_image_url text,
  route text not null,
  created_at timestamptz not null default now(),
  is_published boolean not null default false
);

alter table public.memories enable row level security;

create policy "Published memories are readable"
  on public.memories
  for select
  to anon, authenticated
  using (is_published = true);

insert into public.memories (slug, title, excerpt, route, is_published)
values (
  'graduation-2026',
  'A day worth remembering',
  'A graduation story for Anna Joseph — a little celebration, a letter, a flight, and a keepsake made with love.',
  '/memories/graduation-2026/',
  true
)
on conflict (slug) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  route = excluded.route,
  is_published = excluded.is_published;
