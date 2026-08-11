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
      .select("id, student_no, name")
      .eq("class_id", classId)
      .eq("active", true)
      .order("student_no")
  );
}

// 엑셀에서 읽은 명단으로 맞춥니다.
// 기존 학생은 지우지 않고 active=false 로만 내려서 과거 출결 기록을 지킵니다.
export async function syncStudents(classId, list) {
  if (list.length) {
    check(
      await supabase.from("students").upsert(
        list.map((s) => ({
          class_id: classId,
          student_no: s.no,
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
