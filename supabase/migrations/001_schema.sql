-- 출결 사이트 초기 스키마
-- Supabase 대시보드 > SQL Editor 에 그대로 붙여넣고 Run 하세요.
-- 학생 실명은 저장하지 않습니다. 반 안에서의 번호만 씁니다.

-- ─────────────────────────────────────────────
-- 1. 반
-- ─────────────────────────────────────────────
create table classes (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references auth.users(id) on delete cascade,
  name        text not null,              -- 예: '2학년 3반'
  school_year int  not null,              -- 예: 2026
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 2. 학생 (번호만 저장)
-- ─────────────────────────────────────────────
create table students (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references classes(id) on delete cascade,
  student_no  int  not null,              -- 반 안에서의 번호
  active      boolean not null default true,   -- 전학 등으로 빠지면 false
  created_at  timestamptz not null default now(),
  unique (class_id, student_no)
);

create index students_class_idx on students (class_id, student_no);

-- ─────────────────────────────────────────────
-- 3. 세션 (하루 두 번: 조회 / 종례)
-- ─────────────────────────────────────────────
create type session_kind as enum ('morning', 'evening');

create table sessions (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references classes(id) on delete cascade,
  on_date     date not null,
  kind        session_kind not null,
  opened_at   timestamptz,               -- 출결 받기 시작한 시각
  closed_at   timestamptz,               -- 마감 시각. null 이면 아직 진행 중
  created_at  timestamptz not null default now(),
  unique (class_id, on_date, kind)
);

create index sessions_class_date_idx on sessions (class_id, on_date desc);

-- ─────────────────────────────────────────────
-- 4. 출결 기록
-- ─────────────────────────────────────────────
-- NEIS 입력 형식에 맞춰 '상태'와 '사유'를 나눠 둡니다.
create type att_status as enum (
  'present',      -- 출석
  'late',         -- 지각
  'absent',       -- 결석
  'early_leave',  -- 조퇴
  'partial'       -- 결과
);

create type att_reason as enum (
  'illness',      -- 질병
  'unauthorized', -- 미인정
  'authorized',   -- 인정
  'other'         -- 기타
);

create table attendance (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions(id) on delete cascade,
  student_id  uuid not null references students(id) on delete cascade,
  status      att_status not null default 'present',
  reason      att_reason,                -- 출석이면 null
  marked_at   timestamptz not null default now(),
  source      text not null default 'manual',  -- 'manual' | 'qr'
  note        text,
  unique (session_id, student_id)
);

create index attendance_session_idx on attendance (session_id);
create index attendance_student_idx on attendance (student_id, marked_at desc);

-- ─────────────────────────────────────────────
-- 5. RLS — 담임은 자기 반만 볼 수 있습니다
-- ─────────────────────────────────────────────
alter table classes    enable row level security;
alter table students   enable row level security;
alter table sessions   enable row level security;
alter table attendance enable row level security;

-- 내 반인지 판정하는 헬퍼
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
            where s.id = session_id and owns_class(s.class_id))
  )
  with check (
    exists (select 1 from sessions s
            where s.id = session_id and owns_class(s.class_id))
  );

-- ─────────────────────────────────────────────
-- 6. 자주 쓸 조회 두 개
-- ─────────────────────────────────────────────

-- (1) 명렬표 화면: 특정 세션의 전체 학생 + 현재 상태
--     아직 안 찍은 학생은 status 가 null 로 나옵니다.
--   select st.student_no, a.status, a.reason, a.marked_at
--   from students st
--   left join attendance a
--     on a.student_id = st.id and a.session_id = :session_id
--   where st.class_id = :class_id and st.active
--   order by st.student_no;

-- (2) 월별 집계: 학생별 지각/결석 횟수
--   select st.student_no,
--          count(*) filter (where a.status = 'late')   as late_count,
--          count(*) filter (where a.status = 'absent') as absent_count
--   from students st
--   left join attendance a on a.student_id = st.id
--   left join sessions  s on s.id = a.session_id
--   where st.class_id = :class_id
--     and s.on_date between :from_date and :to_date
--   group by st.student_no
--   order by st.student_no;
