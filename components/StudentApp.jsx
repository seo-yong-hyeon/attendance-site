"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LogOut, QrCode, KeyRound, ChevronRight } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { codeOf, fromRow } from "../lib/codes";
import QrScanner from "./QrScanner";
import * as db from "../lib/db";

const today = () => new Date().toISOString().slice(0, 10);

export default function StudentApp({ me }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const load = useCallback(() => {
    return db
      .listMyAttendance(me.id)
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [me.id]);

  useEffect(() => {
    load();
  }, [load]);

  const todayRows = rows.filter((r) => r.sessions.on_date === today());

  const tally = useMemo(() => {
    const t = {};
    rows.forEach((r) => {
      const c = fromRow(r);
      if (c !== "present") t[c] = (t[c] || 0) + 1;
    });
    return t;
  }, [rows]);

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <div className="bg-yellow-400 px-5 pb-6 pt-6">
        <div className="mx-auto flex max-w-md items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {me.name || me.student_code || `${me.student_no}번`}
            </h1>
            <p className="mt-0.5 text-sm text-slate-800">
              {me.classes?.name} {me.student_no}번
            </p>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex items-center gap-1 text-sm text-slate-700"
          >
            <LogOut size={14} /> 나가기
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-md px-5">
        <button
          onClick={() => setScanning(true)}
          className="-mt-4 flex w-full items-center gap-4 rounded-xl bg-slate-800 px-6 py-6 text-left shadow-lg active:bg-slate-700"
        >
          <QrCode size={40} className="text-yellow-400" />
          <span className="flex-1">
            <span className="block text-lg font-bold text-white">출석 체크</span>
            <span className="block text-sm text-slate-300">
              교실 화면의 QR 을 찍으세요
            </span>
          </span>
          <ChevronRight size={22} className="text-slate-500" />
        </button>

        {error && (
          <p className="mt-4 rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        <div className="mt-4 rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">오늘</h2>
          {todayRows.length === 0 ? (
            <p className="text-sm text-slate-500">
              아직 오늘 기록이 없습니다.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {todayRows.map((r, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500">
                    {r.sessions.kind === "morning" ? "조회" : "종례"}
                  </span>
                  <span
                    className={`ml-auto font-medium ${codeOf(fromRow(r)).cls}`}
                  >
                    {codeOf(fromRow(r)).label}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {Object.keys(tally).length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(tally).map(([k, n]) => (
              <span
                key={k}
                className={`rounded bg-white px-3 py-1.5 text-sm font-medium shadow-sm ${codeOf(k).cls}`}
              >
                {codeOf(k).label} {n}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 overflow-hidden rounded-xl bg-white shadow-sm">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
            지난 기록
          </h2>

          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              불러오는 중…
            </p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              아직 기록이 없습니다.
            </p>
          ) : (
            <ul>
              {rows.map((r, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0"
                >
                  <span className="text-sm tabular-nums text-slate-600">
                    {r.sessions.on_date.slice(5).replace("-", "월 ")}일
                  </span>
                  <span className="text-xs text-slate-400">
                    {r.sessions.kind === "morning" ? "조회" : "종례"}
                  </span>
                  {r.source === "qr" && (
                    <QrCode size={13} className="text-slate-300" />
                  )}
                  <span
                    className={`ml-auto text-sm font-medium ${codeOf(fromRow(r)).cls}`}
                  >
                    {codeOf(fromRow(r)).label}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 rounded-xl bg-white p-4 shadow-sm">
          <button
            onClick={() => setShowPin(!showPin)}
            className="flex w-full items-center gap-1.5 text-sm font-semibold text-slate-700"
          >
            <KeyRound size={14} /> 비밀번호 바꾸기
          </button>
          {showPin && <PinForm />}
        </div>
      </div>

      {scanning && (
        <QrScanner onClose={() => setScanning(false)} onDone={load} />
      )}
    </div>
  );
}

function PinForm() {
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (pin !== pin2) return setMsg("두 번 입력한 비밀번호가 다릅니다.");
    if (pin.length < 6) return setMsg("비밀번호는 6자리 이상이어야 합니다.");
    setBusy(true);
    setMsg("");
    try {
      await db.changePin(pin);
      setMsg("바꿨습니다. 다음부터 새 비밀번호로 들어오세요.");
      setPin("");
      setPin2("");
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <input
        type="password"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        placeholder="새 비밀번호 (숫자 6자리 이상)"
        inputMode="numeric"
        maxLength={8}
        className="mb-2 w-full rounded border border-slate-200 px-3 py-2 text-sm"
      />
      <input
        type="password"
        value={pin2}
        onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))}
        placeholder="한 번 더"
        inputMode="numeric"
        maxLength={8}
        className="mb-2 w-full rounded border border-slate-200 px-3 py-2 text-sm"
      />
      <button
        onClick={submit}
        disabled={busy || pin.length < 6 || pin2.length < 6}
        className="w-full rounded bg-slate-800 py-2 text-sm font-medium text-white disabled:bg-slate-200 disabled:text-slate-400"
      >
        {busy ? "바꾸는 중…" : "바꾸기"}
      </button>
      {msg && <p className="mt-2 text-sm text-slate-600">{msg}</p>}
    </div>
  );
}
