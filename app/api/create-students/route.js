import { requireRole, fail } from "../../../lib/serverSupabase";

const DOMAIN = "class.local";
const DEFAULT_PIN = "000000";

export async function POST(req) {
  let user, admin;
  try {
    ({ user, admin } = await requireRole(req, ["teacher", "master"]));
  } catch (e) {
    return fail(e.message, 403);
  }

  const { classId, students } = await req.json();
  if (!classId || !Array.isArray(students) || students.length === 0) {
    return fail("학생 목록이 비어 있습니다.");
  }
  if (students.length > 200) {
    return fail("한 번에 200명까지만 등록할 수 있습니다.");
  }

  // 남의 반에 넣지 못하도록 확인합니다.
  const { data: klass } = await admin
    .from("classes")
    .select("id, teacher_id")
    .eq("id", classId)
    .maybeSingle();
  if (!klass || klass.teacher_id !== user.id) {
    return fail("본인 반이 아닙니다.", 403);
  }

  const result = { created: 0, existing: 0, failed: [] };

  for (const s of students) {
    const code = String(s.code || "").trim();
    if (!/^\d{2,10}$/.test(code)) {
      result.failed.push({ code, why: "학번 형식이 아닙니다" });
      continue;
    }

    const email = `s${code}@${DOMAIN}`;
    let uid = null;

    const { data: made, error } = await admin.auth.admin.createUser({
      email,
      password: DEFAULT_PIN,
      email_confirm: true,
    });

    if (made?.user) {
      uid = made.user.id;
      result.created += 1;
    } else if (error && error.message.includes("already")) {
      // 이미 있는 계정이면 비밀번호는 건드리지 않고 연결만 유지합니다.
      result.existing += 1;
    } else if (error) {
      result.failed.push({ code, why: error.message });
      continue;
    }

    const row = {
      class_id: classId,
      student_no: s.no,
      student_code: code,
      name: s.name || null,
      active: true,
    };
    if (uid) row.user_id = uid;

    const { error: ue } = await admin
      .from("students")
      .upsert(row, { onConflict: "class_id,student_no" });
    if (ue) result.failed.push({ code, why: ue.message });
  }

  // 이번 명단에 없는 학생은 지우지 않고 내려둡니다.
  const nums = students.map((s) => s.no);
  await admin
    .from("students")
    .update({ active: false })
    .eq("class_id", classId)
    .not("student_no", "in", `(${nums.join(",")})`);

  return Response.json(result);
}
