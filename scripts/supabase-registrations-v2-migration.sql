-- 报名表新增字段（在已有 registrations 表上执行）
-- Supabase SQL Editor 中运行；列已存在时会跳过

alter table public.registrations add column if not exists id_type text;
alter table public.registrations add column if not exists contact_address text;
alter table public.registrations add column if not exists needs_lodging boolean;
alter table public.registrations add column if not exists emergency_name text;
alter table public.registrations add column if not exists emergency_phone text;
alter table public.registrations add column if not exists emergency_relation text;
alter table public.registrations add column if not exists agree_health_declaration boolean;
alter table public.registrations add column if not exists agree_health_questionnaire boolean;
alter table public.registrations add column if not exists agree_conduct_rules boolean;
alter table public.registrations add column if not exists health_answers jsonb;
