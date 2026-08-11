"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

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
    return <div className="p-10 text-center text-sm text-slate-500">불러오는 중…</div>;

  if (!session) return <LoginForm />;

  return children;
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("signin");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMsg("");
    const fn = mode === "signin" ? "signInWithPassword" : "signUp";
    const { error } = await supabase.auth[fn]({ email, password });
    if (error) setMsg(error.message);
    else if (mode === "signup")
      setMsg("가입 확인 메일을 보냈습니다. 메일함을 확인해 주세요.");
    setBusy(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-5">
      <div className="w-full max-w-sm rounded bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-lg font-semibold">세연중학교 출석부</h1>
        <p className="mb-5 text-sm text-slate-500">담임 계정으로 들어가세요.</p>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일"
          className="mb-2 w-full rounded border border-slate-200 px-3 py-2 text-sm"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="비밀번호"
          className="mb-3 w-full rounded border border-slate-200 px-3 py-2 text-sm"
        />

        <button
          onClick={submit}
          disabled={busy || !email || !password}
          className="w-full rounded bg-yellow-400 py-2.5 text-sm font-semibold text-slate-900 disabled:opacity-40"
        >
          {mode === "signin" ? "로그인" : "가입하기"}
        </button>

        {msg && <p className="mt-3 text-sm text-rose-600">{msg}</p>}

        <button
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setMsg("");
          }}
          className="mt-4 w-full text-sm text-slate-500 hover:text-slate-800"
        >
          {mode === "signin" ? "계정이 없으신가요? 가입" : "이미 계정이 있어요"}
        </button>
      </div>
    </div>
  );
}
