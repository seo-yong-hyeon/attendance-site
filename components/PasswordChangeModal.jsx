"use client";

import { useState } from "react";
import { KeyRound, X } from "lucide-react";
import * as db from "../lib/db";

// 선생님/관리자 계정용 비밀번호 변경 버튼 + 모달.
// 학생 쪽 숫자 PIN(components/StudentApp.jsx 의 PinForm)과 달리
// 아무 문자나 쓸 수 있고 최소 8자를 요구합니다 (선생님 계정 생성 규칙과 동일).
export default function PasswordChangeButton({ className }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          className ||
          "flex items-center gap-1 text-sm text-slate-300 hover:text-white"
        }
      >
        <KeyRound size={14} /> 비밀번호 변경
      </button>
      {open && <Modal onClose={() => setOpen(false)} />}
    </>
  );
}

function Modal({ onClose }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (pw !== pw2) return setMsg("두 번 입력한 비밀번호가 다릅니다.");
    if (pw.length < 8) return setMsg("비밀번호는 8자 이상이어야 합니다.");
    setBusy(true);
    setMsg("");
    try {
      await db.changePin(pw);
      setDone(true);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-5">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">비밀번호 변경</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {done ? (
          <>
            <p className="text-sm text-slate-600">
              바꿨습니다. 다음부터 새 비밀번호로 들어오세요.
            </p>
            <button
              onClick={onClose}
              className="mt-4 w-full rounded bg-slate-800 py-2 text-sm font-medium text-white"
            >
              닫기
            </button>
          </>
        ) : (
          <>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="새 비밀번호 (8자 이상)"
              className="mb-2 w-full rounded border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="한 번 더"
              className="mb-2 w-full rounded border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              onClick={submit}
              disabled={busy || pw.length < 8 || pw2.length < 8}
              className="w-full rounded bg-slate-800 py-2 text-sm font-medium text-white disabled:bg-slate-200 disabled:text-slate-400"
            >
              {busy ? "바꾸는 중…" : "바꾸기"}
            </button>
            {msg && <p className="mt-2 text-sm text-rose-600">{msg}</p>}
          </>
        )}
      </div>
    </div>
  );
}
