"use client";

import { useEffect, useState } from "react";
import { GraduationCap, User } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import {
  studentEmail,
  teacherEmail,
  MIN_PIN,
  studentExists,
  claimStudentByCode,
} from "../lib/db";

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setSession(s)
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500">
        불러오는 중…
      </div>
    );

  if (!session) return <LoginScreen />;
  return children;
}

function LoginScreen() {
  const [role, setRole] = useState("student");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-800 px-5 py-10">
      <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-lg">
        <div className="bg-yellow-400 px-6 py-6 text-center">
          <h1 className="text-xl font-bold text-slate-900">세연중학교</h1>
          <p className="mt-0.5 text-sm text-slate-800">출석부</p>
        </div>

        <div className="flex border-b border-slate-200">
          {[
            { id: "student", label: "학생", icon: GraduationCap },
            { id: "teacher", label: "선생님", icon: User },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setRole(t.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 py-3 text-sm font-medium transition ${
                role === t.id
                  ? "border-slate-800 text-slate-900"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              <t.icon size={16} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {role === "student" ? <StudentLogin /> : <TeacherLogin />}
        </div>
      </div>

      <a href="/tools" className="mt-4 text-xs text-slate-400 hover:text-slate-200">
        파이썬 실행 · 반편성 도구 →
      </a>
    </div>
  );
}

function Field(props) {
  return (
    <input
      {...props}
      className="mb-2 w-full rounded border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
    />
  );
}

function StudentLogin() {
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMsg("");
    const email = studentEmail(code.trim());

    try {
      if (!(await studentExists(code.trim()))) {
        throw new Error("등록되지 않은 학번입니다. 담임 선생님께 문의하세요.");
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: pin,
      });
      if (error) throw new Error("비밀번호가 맞지 않습니다.");

      await claimStudentByCode(code.trim());
    } catch (e) {
      setMsg(e.message);
      await supabase.auth.signOut();
    } finally {
      setBusy(false);
    }
  }

  const ready = code.trim().length >= 4 && pin.length >= MIN_PIN;

  return (
    <>
      <Field
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        placeholder="학번 (예: 1101)"
        inputMode="numeric"
        maxLength={10}
      />
      <Field
        type="password"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        onKeyDown={(e) => e.key === "Enter" && ready && submit()}
        placeholder="비밀번호 (처음엔 000000)"
        inputMode="numeric"
        maxLength={8}
      />

      <button
        onClick={submit}
        disabled={busy || !ready}
        className="mt-1 w-full rounded bg-yellow-400 py-2.5 text-sm font-semibold text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
      >
        {busy ? "확인 중…" : "들어가기"}
      </button>

      {msg && <p className="mt-3 text-sm text-rose-600">{msg}</p>}

      <p className="mt-4 text-xs leading-relaxed text-slate-400">
        학번은 1학년 1반 1번이면 1101 입니다.
        처음 들어올 때 비밀번호는 000000 이고,
        들어간 뒤 내 화면에서 바꿀 수 있습니다.
      </p>
    </>
  );
}

function TeacherLogin() {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMsg("");
    const { error } = await supabase.auth.signInWithPassword({
      email: teacherEmail(id),
      password,
    });
    if (error) setMsg("아이디나 비밀번호가 맞지 않습니다.");
    setBusy(false);
  }

  return (
    <>
      <Field
        value={id}
        onChange={(e) => setId(e.target.value)}
        placeholder="아이디"
        autoCapitalize="none"
        autoCorrect="off"
      />
      <Field
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="비밀번호"
      />

      <button
        onClick={submit}
        disabled={busy || !id || !password}
        className="mt-1 w-full rounded bg-slate-800 py-2.5 text-sm font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400"
      >
        {busy ? "확인 중…" : "로그인"}
      </button>

      {msg && <p className="mt-3 text-sm text-rose-600">{msg}</p>}

      <p className="mt-4 text-xs leading-relaxed text-slate-400">
        선생님 계정은 관리자가 직접 만듭니다.
        예전에 이메일로 만드신 계정이 있으면 이메일을 그대로 넣으셔도 됩니다.
      </p>
    </>
  );
}
