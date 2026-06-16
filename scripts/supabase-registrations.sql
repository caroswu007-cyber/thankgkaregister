-- ===========================================================================
-- 唐卡报名 registrations 表与 RLS 策略（可重复执行）
-- 说明：
--   1. 任何人可以从前台报名页提交（INSERT）—— 匿名写入
--   2. 只有携带正确管理口令 header 的请求可以读取报名（SELECT）—— 后台查看
--   3. 永远禁止匿名 UPDATE / DELETE
--
-- 安全模型：
--   - 口令只在数据库 is_admin_request() 函数里维护，前端 JS 看不到
--   - 改口令：把下面 is_admin_request() 函数里的字符串字面量替换成新口令，整段重新执行即可
--
-- ⚠️  本仓库公开，本文件**不能写真实口令**。
--    粘贴到 Supabase SQL Editor 时把下方的 PASTE_YOUR_ADMIN_SECRET_HERE
--    替换成实际口令再执行。
-- ===========================================================================

create table if not exists public.registrations (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null,
  phone text not null,
  wechat text not null,
  email text not null,
  age int not null,
  gender text,
  city text,
  art_base text,
  health_family boolean not null,
  health_body boolean not null,
  health_rules boolean not null,
  id_card text not null,
  id_last6 text not null,
  id_hash text not null,
  submitted_at timestamptz not null,
  id_type text,
  contact_address text,
  needs_lodging boolean,
  emergency_name text,
  emergency_phone text,
  emergency_relation text,
  agree_health_declaration boolean,
  agree_health_questionnaire boolean,
  agree_conduct_rules boolean,
  health_answers jsonb
);

alter table public.registrations enable row level security;

-- ---------------------------------------------------------------------------
-- 1) 唯一的口令存放点：is_admin_request()
--    SELECT 策略和 admin_check_secret() RPC 都引用这里，改一次就到处生效
-- ---------------------------------------------------------------------------
create or replace function public.is_admin_request()
returns boolean
language plpgsql
stable
as $$
begin
  return coalesce(
    current_setting('request.headers', true)::json->>'x-tangka-admin-secret',
    ''
  ) = 'PASTE_YOUR_ADMIN_SECRET_HERE';
end;
$$;

grant execute on function public.is_admin_request() to anon;

-- ---------------------------------------------------------------------------
-- 2) 显式的口令校验 RPC：admin.html 登录时先调用它，能成功 → 口令对
-- ---------------------------------------------------------------------------
create or replace function public.admin_check_secret()
returns void
language plpgsql
stable
as $$
begin
  if not public.is_admin_request() then
    raise exception '管理口令错误'
      using errcode = '42501';
  end if;
end;
$$;

grant execute on function public.admin_check_secret() to anon;

-- ---------------------------------------------------------------------------
-- 3) 策略：匿名可写入（前台报名页）
-- ---------------------------------------------------------------------------
drop policy if exists "允许匿名插入报名" on public.registrations;
create policy "允许匿名插入报名"
  on public.registrations
  for insert
  to anon
  with check (true);

-- ---------------------------------------------------------------------------
-- 4) 策略：管理员凭口令读取（admin.html）
-- ---------------------------------------------------------------------------
drop policy if exists "管理员凭口令读取报名" on public.registrations;
create policy "管理员凭口令读取报名"
  on public.registrations
  for select
  to anon
  using (public.is_admin_request());

-- ---------------------------------------------------------------------------
-- 5) 学员自助查询 RPC：按姓名 + 身份证后 6 位返回有限字段
--    不给 anon 开表级 SELECT，避免整表被读取。
-- ---------------------------------------------------------------------------
drop function if exists public.query_registration_status(text, text);
drop function if exists public.query_registration_status(text, text, text);

create or replace function public.query_registration_status(
  q_name text,
  q_id_last6 text,
  q_id_type text default '身份证'
)
returns table (
  name text,
  phone text,
  wechat text,
  submitted_at timestamptz,
  status_display text,
  current_course_line text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.name,
    r.phone,
    r.wechat,
    r.submitted_at,
    '已提交报名'::text as status_display,
    '唐卡传承公益体验课'::text as current_course_line
  from public.registrations r
  where trim(r.name) = trim(q_name)
    and coalesce(r.id_type, '身份证') = coalesce(nullif(trim(q_id_type), ''), '身份证')
    and (
      (
        coalesce(nullif(trim(q_id_type), ''), '身份证') = '身份证'
        and r.id_last6 = regexp_replace(coalesce(q_id_last6, ''), '\D', '', 'g')
      )
      or (
        coalesce(nullif(trim(q_id_type), ''), '身份证') <> '身份证'
        and upper(r.id_last6) = upper(trim(coalesce(q_id_last6, '')))
      )
    )
  order by r.submitted_at desc
  limit 2;
$$;

grant execute on function public.query_registration_status(text, text, text) to anon;
