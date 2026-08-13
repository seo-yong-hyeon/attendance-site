-- 004: 학번 로그인 + QR 출결
-- 003 에서 만든 학급코드 방식은 쓰지 않습니다. 학번 하나로 로그인합니다.

alter table students add column if not exists student_code text;
create unique index if not exists students_code_uidx
  on students (student_code) where student_code is not null;

-- ─────────────────────────────────────────────
-- QR 토큰: 몇 초마다 새로 만들어지고 금방 만료됩니다.
-- 화면을 찍어 단톡방에 뿌려도 이미 만료돼 소용이 없습니다.
-- ─────────────────────────────────────────────
create table if not exists qr_tokens (
  token      uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists qr_tokens_session_idx on qr_tokens (session_id);
alter table qr_tokens enable row level security;

drop policy if exists "teacher manages qr" on qr_tokens;
create policy "teacher manages qr" on qr_tokens
  for all using (
    exists (select 1 from sessions s
            where s.id = qr_tokens.session_id and owns_class(s.class_id))
  )
  with check (
    exists (select 1 from sessions s
            where s.id = qr_tokens.session_id and owns_class(s.class_id))
  );

-- ─────────────────────────────────────────────
-- 로그인 전에도 학번이 있는지 확인할 수 있어야 합니다.
-- 존재 여부(true/false)만 돌려주므로 명단이 새지 않습니다.
-- ─────────────────────────────────────────────
create or replace function student_exists(p_code text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from students
    where student_code = p_code and active
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

-- ─────────────────────────────────────────────
-- QR 체크인
-- ─────────────────────────────────────────────
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
