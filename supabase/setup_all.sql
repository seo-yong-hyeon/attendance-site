-- ════════════════════════════════════════════════════════════
--  세연중학교 출석부 — 전체 설치 SQL (001 ~ 005 통합)
--
--  실행 순서
--   1) Authentication > Users > Add user 로 admin@sy.local 계정 생성
--      (Auto Confirm User 반드시 켜기)
--   2) 이 파일 전체를 SQL Editor 에 붙여넣고 Run
--
--  여러 번 실행해도 안전합니다.
-- ════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────
-- 1. 타입
-- ────────────────────────────────────────────
do $$ begin
  create type session_kind as enum ('morning', 'evening');
exception when duplicate_object then null; end $$;

do $$ begin
  create type att_status as enum (
    'present',      -- 출석
    'late',         -- 지각
    'absent',       -- 결석
    'early_leave',  -- 조퇴
    'partial'       -- 결과
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type att_reason as enum (
    'illness',      -- 질병
    'unauthorized', -- 미인정
    'authorized',   -- 인정
    'other'         -- 기타
  );
exception when duplicate_object then null; end $$;


-- ────────────────────────────────────────────
-- 2. 표
-- ────────────────────────────────────────────
create table if not exists classes (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  school_year int  not null,
  join_code   text unique,
  created_at  timestamptz not null default now()
);

create table if not exists students (
  id           uuid primary key default gen_random_uuid(),
  class_id     uuid not null references classes(id) on delete cascade,
  student_no   int  not null,
  student_code text,
  name         text,
  user_id      uuid references auth.users(id),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (class_id, student_no)
);

create index if not exists students_class_idx on students (class_id, student_no);
create index if not exists students_user_idx  on students (user_id);
create unique index if not exists students_code_uidx
  on students (student_code) where student_code is not null;

create table if not exists sessions (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references classes(id) on delete cascade,
  on_date    date not null,
  kind       session_kind not null,
  opened_at  timestamptz,
  closed_at  timestamptz,
  created_at timestamptz not null default now(),
  unique (class_id, on_date, kind)
);

create index if not exists sessions_class_date_idx
  on sessions (class_id, on_date desc);

create table if not exists attendance (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  status     att_status not null default 'present',
  reason     att_reason,
  marked_at  timestamptz not null default now(),
  source     text not null default 'manual',   -- 'manual' | 'qr'
  note       text,
  unique (session_id, student_id)
);

create index if not exists attendance_session_idx on attendance (session_id);
create index if not exists attendance_student_idx on attendance (student_id, marked_at desc);

create table if not exists qr_tokens (
  token      uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists qr_tokens_session_idx on qr_tokens (session_id);

create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('master', 'teacher')),
  login_id   text,
  name       text,
  created_at timestamptz not null default now()
);


-- ────────────────────────────────────────────
-- 3. 판정 함수
-- ────────────────────────────────────────────
create or replace function owns_class(target uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from classes c
    where c.id = target and c.teacher_id = auth.uid()
  );
$$;

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


-- ────────────────────────────────────────────
-- 4. 접근 권한 (RLS)
-- ────────────────────────────────────────────
alter table classes    enable row level security;
alter table students   enable row level security;
alter table sessions   enable row level security;
alter table attendance enable row level security;
alter table qr_tokens  enable row level security;
alter table profiles   enable row level security;

-- 선생님: 자기 반만
drop policy if exists "own classes"    on classes;
drop policy if exists "own students"   on students;
drop policy if exists "own sessions"   on sessions;
drop policy if exists "own attendance" on attendance;
drop policy if exists "teacher manages qr" on qr_tokens;

create policy "own classes" on classes
  for all using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

create policy "own students" on students
  for all using (owns_class(class_id))
  with check (owns_class(class_id));

create policy "own sessions" on sessions
  for all using (owns_class(class_id))
  with check (owns_class(class_id));

create policy "own attendance" on attendance
  for all using (
    exists (select 1 from sessions s
            where s.id = attendance.session_id and owns_class(s.class_id))
  )
  with check (
    exists (select 1 from sessions s
            where s.id = attendance.session_id and owns_class(s.class_id))
  );

create policy "teacher manages qr" on qr_tokens
  for all using (
    exists (select 1 from sessions s
            where s.id = qr_tokens.session_id and owns_class(s.class_id))
  )
  with check (
    exists (select 1 from sessions s
            where s.id = qr_tokens.session_id and owns_class(s.class_id))
  );

-- 학생: 자기 것만
drop policy if exists "student reads self"        on students;
drop policy if exists "student reads own class"   on classes;
drop policy if exists "student reads own session" on sessions;
drop policy if exists "student reads own att"     on attendance;

create policy "student reads self" on students
  for select using (user_id = auth.uid());

create policy "student reads own class" on classes
  for select using (
    exists (select 1 from students s
            where s.class_id = classes.id and s.user_id = auth.uid())
  );

create policy "student reads own session" on sessions
  for select using (
    exists (select 1 from students s
            where s.class_id = sessions.class_id and s.user_id = auth.uid())
  );

create policy "student reads own att" on attendance
  for select using (
    exists (select 1 from students s
            where s.id = attendance.student_id and s.user_id = auth.uid())
  );

-- 역할
drop policy if exists "read own profile"       on profiles;
drop policy if exists "master reads all profiles" on profiles;
drop policy if exists "master reads all classes"  on classes;

create policy "read own profile" on profiles
  for select using (id = auth.uid());

create policy "master reads all profiles" on profiles
  for select using (is_master());

create policy "master reads all classes" on classes
  for select using (is_master());


-- ────────────────────────────────────────────
-- 5. 학생 로그인 / QR 함수
-- ────────────────────────────────────────────

-- 로그인 전에도 학번이 등록돼 있는지 확인 (존재 여부만 알려줍니다)
create or replace function student_exists(p_code text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from students where student_code = p_code and active
  );
$$;

grant execute on function student_exists(text) to anon, authenticated;

-- 로그인한 계정을 학번에 연결
create or replace function claim_student_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_owner uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select id, user_id into v_id, v_owner
  from students
  where student_code = p_code and active;

  if v_id is null then
    raise exception '등록되지 않은 학번입니다.';
  end if;

  if v_owner is not null and v_owner <> auth.uid() then
    raise exception '이미 다른 계정에 연결된 학번입니다. 담임 선생님께 말씀해 주세요.';
  end if;

  update students set user_id = auth.uid() where id = v_id;
  return v_id;
end;
$$;

grant execute on function claim_student_by_code(text) to authenticated;

-- QR 체크인
create or replace function check_in(p_token uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session uuid;
  v_student uuid;
  v_no      int;
  v_now     timestamptz := now();
  v_existing att_status;
begin
  select session_id into v_session
  from qr_tokens
  where token = p_token and expires_at > v_now;

  if v_session is null then
    raise exception '만료된 QR 입니다. 화면을 다시 찍어주세요.';
  end if;

  select id, student_no into v_student, v_no
  from students
  where user_id = auth.uid() and active;

  if v_student is null then
    raise exception '학생 정보를 찾을 수 없습니다.';
  end if;

  if not exists (
    select 1 from sessions se
    join students st on st.class_id = se.class_id
    where se.id = v_session and st.id = v_student
  ) then
    raise exception '우리 반 출결이 아닙니다.';
  end if;

  select status into v_existing
  from attendance where session_id = v_session and student_id = v_student;

  if v_existing is not null then
    return json_build_object('ok', true, 'already', true, 'no', v_no);
  end if;

  insert into attendance (session_id, student_id, status, source, marked_at)
  values (v_session, v_student, 'present', 'qr', v_now);

  return json_build_object('ok', true, 'already', false, 'no', v_no);
end;
$$;

grant execute on function check_in(uuid) to authenticated;


-- ────────────────────────────────────────────
-- 6. admin 계정을 마스터로 지정
--    (Authentication > Users 에서 먼저 만들어 두셔야 합니다)
-- ────────────────────────────────────────────
insert into profiles (id, role, login_id, name)
select id, 'master', 'admin', '관리자'
from auth.users
where email = 'admin@sy.local'
on conflict (id) do update set role = 'master';


-- ────────────────────────────────────────────
-- 7. 확인
-- ────────────────────────────────────────────
select u.email, coalesce(p.role, '(없음)') as role
from auth.users u
left join profiles p on p.id = u.id
order by u.created_at;
