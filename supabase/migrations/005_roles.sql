-- 005: 마스터 / 선생님 / 학생 세 단계 권한
--
-- 마스터  : 선생님 계정을 만든다
-- 선생님  : 자기 반 학생 계정을 엑셀로 만든다
-- 학생    : 자기 출결만 본다
--
-- 계정 생성 자체는 서버(API Route)에서 secret 키로만 이루어집니다.
-- 그래서 이 테이블은 브라우저에서 읽기만 가능합니다.

create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('master', 'teacher')),
  login_id   text,
  name       text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create or replace function is_master()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'master'
  );
$$;

drop policy if exists "read own profile" on profiles;
drop policy if exists "master reads all profiles" on profiles;

create policy "read own profile" on profiles
  for select using (id = auth.uid());

create policy "master reads all profiles" on profiles
  for select using (is_master());

-- 마스터는 선생님별 반 현황도 볼 수 있어야 합니다.
drop policy if exists "master reads all classes" on classes;
create policy "master reads all classes" on classes
  for select using (is_master());

-- ─────────────────────────────────────────────
-- 여기부터는 계정을 만든 다음에 한 번만 실행하세요.
-- Authentication > Users 에서 admin@sy.local 을 먼저 만들어야 합니다.
-- ─────────────────────────────────────────────
insert into profiles (id, role, login_id, name)
select id, 'master', 'admin', '관리자'
from auth.users
where email = 'admin@sy.local'
on conflict (id) do update set role = 'master';
