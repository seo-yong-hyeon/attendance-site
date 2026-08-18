"use client";

import { useEffect, useState } from "react";
import { LogOut, UserPlus, ShieldCheck } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import * as db from "../lib/db";
import PasswordChangeButton from "./PasswordChangeModal";

export default function MasterApp() {
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  async function load() {
    try {
      const [t, c] = await Promise.all([db.listTeachers(), db.listAllClasses()]);
      setTeachers(t);
      setClasses(c);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-slate-800">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 pb-4 pt-4">
          <h1 className="flex items-center gap-2 text-lg font-semibold text-white">
            <ShieldCheck size={18} className="text-yellow-400" />
            관리자
          </h1>
          <div className="flex items-center gap-4">
            <PasswordChangeButton className="flex items-center gap-1 text-sm text-slate-300 hover:text-white" />
            <button
              onClick={() => supabase.auth.signOut()}
              className="flex items-center gap-1 text-sm text-slate-300 hover:text-white"
            >
              <LogOut size={14} /> 로그아웃
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-5 py-5">
        {error && (
          <p className="mb-3 rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">
            선생님 {teachers.length}명
          </h2>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1.5 rounded bg-yellow-400 px-4 py-2 text-sm font-semibold text-slate-900"
          >
            <UserPlus size={15} /> 선생님 추가
          </button>
        </div>

        {open && (
          <NewTeacher
            onDone={() => {
              setOpen(false);
              load();
            }}
          />
        )}

        <div className="overflow-hidden rounded bg-white shadow-sm">
          {loading ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              불러오는 중…
            </p>
          ) : teachers.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              아직 등록된 선생님이 없습니다.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                  <th className="px-4 py-2 font-medium">아이디</th>
                  <th className="px-4 py-2 font-medium">이름</th>
                  <th className="px-4 py-2 font-medium">담당 반</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2.5 font-medium">{t.login_id}</td>
                    <td className="px-4 py-2.5 text-slate-600">{t.name || "-"}</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {classes.find((c) => c.teacher_id === t.id)?.name || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="mt-4 text-xs leading-relaxed text-slate-400">
          선생님이 로그인하면 자기 반 학생 명단을 엑셀로 올릴 수 있습니다.
          학생 계정은 그때 학번으로 자동 생성되고 초기 비밀번호는 000000 입니다.
        </p>
      </div>
    </div>
  );
}

function NewTeacher({ onDone }) {
  const [f, setF] = useState({
    loginId: "",
    password: "",
    name: "",
    className: "",
  });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit() {
    setBusy(true);
    setMsg("");
    try {
      await db.createTeacher(f);
      onDone();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 rounded bg-white p-4 shadow-sm">
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={f.loginId}
          onChange={set("loginId")}
          placeholder="아이디 (예: kim)"
          autoCapitalize="none"
          className="rounded border border-slate-200 px-3 py-2 text-sm"
        />
        <input
          type="password"
          value={f.password}
          onChange={set("password")}
          placeholder="비밀번호 (8자 이상)"
          className="rounded border border-slate-200 px-3 py-2 text-sm"
        />
        <input
          value={f.name}
          onChange={set("name")}
          placeholder="이름"
          className="rounded border border-slate-200 px-3 py-2 text-sm"
        />
        <input
          value={f.className}
          onChange={set("className")}
          placeholder="담당 반 (예: 1학년 3반)"
          className="rounded border border-slate-200 px-3 py-2 text-sm"
        />
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={submit}
          disabled={busy || !f.loginId || f.password.length < 8}
          className="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-200 disabled:text-slate-400"
        >
          {busy ? "만드는 중…" : "만들기"}
        </button>
        <button
          onClick={onDone}
          className="rounded px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
        >
          취소
        </button>
      </div>

      {msg && <p className="mt-2 text-sm text-rose-600">{msg}</p>}
    </div>
  );
}
