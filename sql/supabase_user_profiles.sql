-- user_profiles：VIP、权限、管理员标记；供网站 /user 与扩展读取
-- 在 Supabase SQL Editor 中执行（一次性）。执行后请手动将首个管理员账号 is_admin = true。

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  is_admin boolean not null default false,
  vip_status boolean not null default false,
  vip_expires_at timestamptz,
  permissions jsonb not null default '{"open_all_pages": false, "auto_fill": false}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_profiles_email_idx on public.user_profiles (email);

comment on table public.user_profiles is '用户扩展资料：VIP、功能权限、管理员；与 auth.users 1:1';
comment on column public.user_profiles.permissions is 'JSON：open_all_pages、auto_fill 等布尔开关';

-- 管理员判断（SECURITY DEFINER 避免 RLS 自引用问题）
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from public.user_profiles p where p.user_id = auth.uid()),
    false
  );
$$;

grant execute on function public.is_admin() to authenticated;

-- 新用户自动建档（从 auth.users）
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', '')
  )
  on conflict (user_id) do update
    set email = excluded.email,
        display_name = coalesce(nullif(excluded.display_name, ''), public.user_profiles.display_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 已有账号补档（仅缺档时插入）
insert into public.user_profiles (user_id, email, display_name)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'display_name', '')
from auth.users u
where not exists (select 1 from public.user_profiles p where p.user_id = u.id)
on conflict (user_id) do nothing;

alter table public.user_profiles enable row level security;

drop policy if exists "user_profiles_select" on public.user_profiles;
drop policy if exists "user_profiles_insert_own" on public.user_profiles;
drop policy if exists "user_profiles_update_admin" on public.user_profiles;

-- 本人可读；管理员可读全部
create policy "user_profiles_select"
on public.user_profiles for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

-- 仅本人可插入自己的行（兜底；通常由触发器写入）
create policy "user_profiles_insert_own"
on public.user_profiles for insert
to authenticated
with check (user_id = auth.uid());

-- 仅管理员可改任意行（含 VIP / 权限 / is_admin）
create policy "user_profiles_update_admin"
on public.user_profiles for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select, insert, update on public.user_profiles to authenticated;

-- 首个管理员：把下面邮箱改成你的账号后执行一行
-- update public.user_profiles set is_admin = true where email = '你的邮箱@example.com';
