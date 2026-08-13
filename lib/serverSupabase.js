// 서버(API Route)에서만 씁니다. 브라우저 코드에서 절대 import 하지 마세요.
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function adminClient() {
  if (!SECRET) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다. 환경변수를 확인해 주세요."
    );
  }
  return createClient(URL, SECRET, { auth: { persistSession: false } });
}

// 요청을 보낸 사람이 누구인지 확인하고, 필요한 역할인지 검사합니다.
export async function requireRole(req, allowed) {
  const token = (req.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) throw new Error("로그인이 필요합니다.");

  const asUser = createClient(URL, ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error,
  } = await asUser.auth.getUser();
  if (error || !user) throw new Error("로그인이 필요합니다.");

  const admin = adminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role;
  if (!allowed.includes(role)) {
    throw new Error("권한이 없습니다.");
  }

  return { user, role, admin };
}

export function fail(message, status = 400) {
  return Response.json({ error: message }, { status });
}
