import { requireRole, fail } from "../../../lib/serverSupabase";

const DOMAIN = "sy.local";

export async function POST(req) {
  let admin;
  try {
    ({ admin } = await requireRole(req, ["master"]));
  } catch (e) {
    return fail(e.message, 403);
  }

  const { loginId, password, name, className } = await req.json();

  if (!loginId || !password || password.length < 8) {
    return fail("아이디와 8자 이상의 비밀번호를 입력해 주세요.");
  }

  const email = loginId.includes("@") ? loginId : `${loginId}@${DOMAIN}`;

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    return fail(
      error.message.includes("already")
        ? "이미 있는 아이디입니다."
        : error.message
    );
  }

  const uid = created.user.id;

  const { error: pe } = await admin
    .from("profiles")
    .upsert({ id: uid, role: "teacher", login_id: loginId, name: name || null });
  if (pe) return fail(pe.message);

  // 선생님마다 반 하나를 함께 만들어 둡니다.
  const { error: ce } = await admin.from("classes").insert({
    teacher_id: uid,
    name: className || "우리 반",
    school_year: new Date().getFullYear(),
  });
  if (ce) return fail(ce.message);

  return Response.json({ ok: true, loginId, email });
}
