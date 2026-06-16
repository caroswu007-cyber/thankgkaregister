-- 管理后台删除报名记录权限
-- 适用于已执行过 scripts/supabase-registrations.sql、且 public.is_admin_request()
-- 已维护好真实管理口令的 Supabase 项目。

drop policy if exists "管理员凭口令删除报名" on public.registrations;

create policy "管理员凭口令删除报名"
  on public.registrations
  for delete
  to anon
  using (public.is_admin_request());
