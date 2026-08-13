import { supabase } from "./supabaseClient";
import { toRow } from "./codes";

function check({ data, error }) {
  if (error) throw error;
  return data;
}

// ── 반 ──────────────────────────────────────────
export async function getOrCreateClass(defaultName = "우리 반") {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const rows = check(
    await supabase
      .from("classes")
      .select("*")
      .eq("teacher_id", user.id)
      .order("created_at")
      .limit(1)
  );
  if (rows.length) return rows[0];

  return check(
    await supabase
      .from("classes")
      .insert({
        teacher_id: user.id,
        name: defaultName,
        school_year: new Date().getFullYear(),
      })
      .select()
      .single()
  );
}

export async function renameClass(classId, name) {
  check(await supabase.from("classes").update({ name }).eq("id", classId));
}

// ── 학생 ────────────────────────────────────────
export async function listStudents(classId) {
  return check(
    await supabase
      .from("students")
      .select("id, student_no, student_code, name, user_id")
      .eq("class_id", classId)
      .eq("active", true)
      .order("student_no")
  );
}

// 엑셀에서 읽은 명단으로 맞춥니다. 기준은 학번입니다.
// 기존 학생은 지우지 않고 active=false 로만 내려서 과거 기록을 지킵니다.
export async function syncStudents(classId, list) {
  if (list.length) {
    check(
      await supabase.from("students").upsert(
        list.map((s) => ({
          class_id: classId,
          student_no: s.no,
          student_code: s.code,
          name: s.name || null,
          active: true,
        })),
        { onConflict: "class_id,student_no" }
      )
    );
  }

  const nums = list.map((s) => s.no);
  const q = supabase
    .from("students")
    .update({ active: false })
    .eq("class_id", classId);
  check(await (nums.length ? q.not("student_no", "in", `(${nums.join(",")})`) : q));

  return listStudents(classId);
}

// ── 세션 ────────────────────────────────────────
export async function findSession(classId, onDate, kind) {
  const rows = check(
    await supabase
      .from("sessions")
      .select("*")
      .eq("class_id", classId)
      .eq("on_date", onDate)
      .eq("kind", kind)
      .limit(1)
  );
  return rows[0] || null;
}

export async function getOrCreateSession(classId, onDate, kind) {
  const found = await findSession(classId, onDate, kind);
  if (found) return found;

  return check(
    await supabase
      .from("sessions")
      .insert({
        class_id: classId,
        on_date: onDate,
        kind,
        opened_at: new Date().toISOString(),
      })
      .select()
      .single()
  );
}

export async function listSessions(classId, fromDate) {
  return check(
    await supabase
      .from("sessions")
      .select("id, on_date, kind")
      .eq("class_id", classId)
      .gte("on_date", fromDate)
      .order("on_date", { ascending: false })
  );
}

// ── 출결 ────────────────────────────────────────
export async function listAttendance(sessionIds) {
  if (!sessionIds.length) return [];
  return check(
    await supabase
      .from("attendance")
      .select("session_id, student_id, status, reason, note")
      .in("session_id", sessionIds)
  );
}

// 출석이고 메모도 없으면 행을 지웁니다. 스키마 설계대로 출석은 기록하지 않습니다.
export async function saveMarks(sessionId, changes) {
  const drop = changes.filter((c) => c.code === "present" && !c.memo);
  const keep = changes.filter((c) => !(c.code === "present" && !c.memo));

  if (drop.length) {
    check(
      await supabase
        .from("attendance")
        .delete()
        .eq("session_id", sessionId)
        .eq("source", "manual")
        .in(
          "student_id",
          drop.map((c) => c.studentId)
        )
    );
  }

  if (keep.length) {
    check(
      await supabase.from("attendance").upsert(
        keep.map((c) => ({
          session_id: sessionId,
          student_id: c.studentId,
          ...toRow(c.code),
          note: c.memo || null,
          source: "manual",
          marked_at: new Date().toISOString(),
        })),
        { onConflict: "session_id,student_id" }
      )
    );
  }
}

export async function closeSession(sessionId, close = true) {
  check(
    await supabase
      .from("sessions")
      .update({ closed_at: close ? new Date().toISOString() : null })
      .eq("id", sessionId)
  );
}

// ── 학생 로그인 (학번 + 비밀번호) ───────────────
// Supabase 가 비밀번호 6자 이상을 요구하므로 초기값도 6자리입니다.
export const DEFAULT_PIN = "000000";
export const MIN_PIN = 6;
export const STUDENT_DOMAIN = "class.local";

export const studentEmail = (code) => `s${code}@${STUDENT_DOMAIN}`;

// ── 선생님 로그인 ───────────────────────────────
// 아이디만 입력하면 뒤에 도메인을 붙여 씁니다.
// 예전에 이메일로 만든 계정도 그대로 쓸 수 있게, @ 가 있으면 그대로 둡니다.
export const TEACHER_DOMAIN = "sy.local";
export const teacherEmail = (id) =>
  id.includes("@") ? id.trim() : `${id.trim()}@${TEACHER_DOMAIN}`;

// ── 서버 API 호출 (계정 생성) ────────────────────
async function callApi(path, body) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || ""}`,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "요청에 실패했습니다.");
  return json;
}

export const createTeacher = (payload) => callApi("/api/create-teacher", payload);
export const createStudents = (classId, students) =>
  callApi("/api/create-students", { classId, students });

// ── 역할 ────────────────────────────────────────
export async function getMyProfile() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, role, login_id, name")
    .eq("id", user.id)
    .maybeSingle();
  return data || null;
}

export async function listTeachers() {
  return check(
    await supabase
      .from("profiles")
      .select("id, login_id, name, created_at")
      .eq("role", "teacher")
      .order("created_at")
  );
}

export async function listAllClasses() {
  return check(
    await supabase.from("classes").select("id, name, teacher_id, school_year")
  );
}

export async function studentExists(code) {
  const { data, error } = await supabase.rpc("student_exists", { p_code: code });
  if (error) throw error;
  return data === true;
}

export async function claimStudentByCode(code) {
  const { error } = await supabase.rpc("claim_student_by_code", { p_code: code });
  if (error) throw error;
}

export async function changePin(pin) {
  const { error } = await supabase.auth.updateUser({ password: pin });
  if (error) throw error;
}

// ── 학생 화면 ───────────────────────────────────
export async function getMyStudent() {
  const rows = check(
    await supabase
      .from("students")
      .select("id, student_no, student_code, name, class_id, classes(name)")
      .limit(1)
  );
  return rows[0] || null;
}

export async function listMyAttendance(studentId) {
  const rows = check(
    await supabase
      .from("attendance")
      .select("status, reason, note, source, marked_at, sessions(on_date, kind)")
      .eq("student_id", studentId)
  );
  return rows
    .filter((r) => r.sessions)
    .sort((a, b) =>
      a.sessions.on_date === b.sessions.on_date
        ? a.sessions.kind.localeCompare(b.sessions.kind)
        : b.sessions.on_date.localeCompare(a.sessions.on_date)
    );
}

export async function checkIn(token) {
  const { data, error } = await supabase.rpc("check_in", { p_token: token });
  if (error) throw error;
  return data;
}

// ── QR (교사) ───────────────────────────────────
// 세션마다 QR 하나를 만들어 그날 계속 씁니다.
// (몇 초마다 코드를 바꾸는 기능은 나중에 붙일 예정)
export async function getOrCreateQrToken(sessionId) {
  const rows = check(
    await supabase
      .from("qr_tokens")
      .select("token, expires_at")
      .eq("session_id", sessionId)
      .gt("expires_at", new Date().toISOString())
      .limit(1)
  );
  if (rows.length) return rows[0].token;

  return check(
    await supabase
      .from("qr_tokens")
      .insert({
        session_id: sessionId,
        // 하루가 지나면 자동으로 못 쓰게 됩니다.
        expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      })
      .select("token")
      .single()
  ).token;
}

export async function clearQrTokens(sessionId) {
  await supabase.from("qr_tokens").delete().eq("session_id", sessionId);
}
