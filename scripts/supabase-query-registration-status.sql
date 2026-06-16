-- 学员自助查询 RPC：按姓名 + 证件类型 + 证件后 6 位返回有限字段
-- 可单独在 Supabase SQL Editor 执行；不会修改后台管理口令。

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
