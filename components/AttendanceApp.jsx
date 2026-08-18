"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, Save, Check, Trash2, LogOut, QrCode, X } from "lucide-react";
import QRCode from "qrcode";
import { supabase } from "../lib/supabaseClient";
import { CODES, codeOf, fromRow } from "../lib/codes";
import * as db from "../lib/db";
import PlacementApp from "./placement/PlacementApp";
import PasswordChangeButton from "./PasswordChangeModal";

const SCHOOL = "세연중학교";
const DAY = ["일", "월", "화", "수", "목", "금", "토"];

function recentSessions(count) {
  const out = [];
  const d = new Date();
  while (out.length < count) {
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) {
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const label = `${d.getMonth() + 1}월${d.getDate()}일(${DAY[wd]})`;
      out.push({ id: `${date}|evening`, date, label, kind: "evening", kindLabel: "종례" });
      out.push({ id: `${date}|morning`, date, label, kind: "morning", kindLabel: "조회" });
    }
    d.setDate(d.getDate() - 1);
  }
  return out;
}

export default function AttendanceApp() {
  const [tab, setTab] = useState("sheet");
  const [klass, setKlass] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const slots = useMemo(() => recentSessions(24), []);
  const [current, setCurrent] = useState(slots[0]);
  const [marks, setMarks] = useState({});
  const [dirty, setDirty] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [qrSession, setQrSession] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const c = await db.getOrCreateClass("우리 반");
        setKlass(c);
        setStudents(await db.listStudents(c.id));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!klass) return;
    let alive = true;
    (async () => {
      try {
        const s = await db.findSession(klass.id, current.date, current.kind);
        const rows = s ? await db.listAttendance([s.id]) : [];
        if (!alive) return;
        const byNo = {};
        rows.forEach((r) => {
          const st = students.find((x) => x.id === r.student_id);
          if (st) byNo[st.student_no] = { code: fromRow(r), memo: r.note || "" };
        });
        setMarks(byNo);
        setDirty(new Set());
      } catch (e) {
        setError(e.message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [klass, current, students]);

  function setCell(no, patch) {
    setMarks((prev) => ({
      ...prev,
      [no]: { code: "present", memo: "", ...(prev[no] || {}), ...patch },
    }));
    setDirty((prev) => new Set(prev).add(no));
  }

  async function save() {
    if (!dirty.size) return;
    setSaving(true);
    setError("");
    try {
      const session = await db.getOrCreateSession(klass.id, current.date, current.kind);
      const changes = [...dirty].map((no) => {
        const st = students.find((x) => x.student_no === Number(no));
        const m = marks[no] || { code: "present", memo: "" };
        return { studentId: st.id, code: m.code, memo: m.memo };
      });
      await db.saveMarks(session.id, changes);
      setDirty(new Set());
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function startQr() {
    setError("");
    try {
      const session = await db.getOrCreateSession(
        klass.id,
        current.date,
        current.kind
      );
      setQrSession(session);
    } catch (e) {
      setError(e.message);
    }
  }

  async function reloadMarks() {
    const s = await db.findSession(klass.id, current.date, current.kind);
    const rows = s ? await db.listAttendance([s.id]) : [];
    const byNo = {};
    rows.forEach((r) => {
      const st = students.find((x) => x.id === r.student_id);
      if (st) byNo[st.student_no] = { code: fromRow(r), memo: r.note || "" };
    });
    setMarks(byNo);
    setDirty(new Set());
  }

  const tabs = [
    { id: "sheet", label: "출석부" },
    { id: "roster", label: "학생관리" },
    { id: "report", label: "지각/결석 조회" },
    { id: "placement", label: "반편성" },
  ];

  if (loading)
    return <div className="p-10 text-center text-sm text-slate-500">불러오는 중…</div>;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="bg-slate-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 pb-2 pt-4">
          <h1 className="text-lg font-semibold text-white">{SCHOOL}</h1>
          <div className="flex items-center gap-4">
            <PasswordChangeButton className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-white" />
            <button
              onClick={() => supabase.auth.signOut()}
              className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-white"
            >
              <LogOut size={14} /> 로그아웃
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-6 px-5">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`border-b-2 pb-2.5 text-sm font-medium transition ${
                tab === t.id
                  ? "border-yellow-400 text-yellow-400"
                  : "border-transparent text-slate-300 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mx-auto max-w-5xl px-5 py-4">
        <p className="mb-3 text-xs text-slate-500">
          {tabs.find((t) => t.id === tab).label}
          <span className="mx-1.5">›</span>
          <span className="font-medium text-slate-700">{klass?.name}</span>
        </p>

        {error && (
          <p className="mb-3 rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        {tab === "sheet" && (
          <Sheet
            klass={klass}
            students={students}
            slots={slots}
            current={current}
            setCurrent={setCurrent}
            marks={marks}
            setCell={setCell}
            dirty={dirty}
            saving={saving}
            onSave={save}
            onStartQr={startQr}
          />
        )}
        {tab === "roster" && (
          <Roster
            klass={klass}
            setKlass={setKlass}
            students={students}
            setStudents={setStudents}
            setError={setError}
          />
        )}
        {tab === "report" && <Report klass={klass} students={students} />}
        {tab === "placement" && <PlacementApp />}
      </div>

      {qrSession && (
        <QrModal
          session={qrSession}
          total={students.length}
          onClose={() => {
            setQrSession(null);
            reloadMarks().catch(() => {});
          }}
        />
      )}
    </div>
  );
}

function QrModal({ session, total, onClose }) {
  const [img, setImg] = useState("");
  const [count, setCount] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const token = await db.getOrCreateQrToken(session.id);
        const url = `${window.location.origin}/checkin?t=${token}`;
        const data = await QRCode.toDataURL(url, { width: 720, margin: 1 });
        if (alive) setImg(data);
      } catch (e) {
        if (alive) setError(e.message);
      }
    })();

    const poll = setInterval(async () => {
      try {
        const rows = await db.listAttendance([session.id]);
        if (alive) setCount(rows.length);
      } catch (e) {
        /* 무시하고 다음 주기에 다시 */
      }
    }, 4000);

    return () => {
      alive = false;
      clearInterval(poll);
    };
  }, [session.id]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900 px-6">
      <button
        onClick={onClose}
        className="absolute right-5 top-5 flex items-center gap-1 text-sm text-slate-300 hover:text-white"
      >
        <X size={18} /> 닫기
      </button>

      <p className="mb-1 text-sm text-slate-400">휴대폰 카메라로 찍으세요</p>
      <p className="mb-5 text-3xl font-bold text-yellow-400">
        {count} <span className="text-lg text-slate-400">/ {total}</span>
      </p>

      <div className="rounded-xl bg-white p-4">
        {img ? (
          <img src={img} alt="출결 QR" className="h-64 w-64 sm:h-80 sm:w-80" />
        ) : (
          <div className="flex h-64 w-64 items-center justify-center text-sm text-slate-400 sm:h-80 sm:w-80">
            {error || "QR 만드는 중…"}
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-sm text-slate-400">
        이 QR 은 이번 조회·종례 동안 계속 쓸 수 있습니다.
      </p>
    </div>
  );
}

function Sheet({ klass, students, slots, current, setCurrent, marks, setCell, dirty, saving, onSave, onStartQr }) {
  const summary = useMemo(() => {
    const c = {};
    Object.values(marks).forEach((m) => {
      if (m.code !== "present") c[m.code] = (c[m.code] || 0) + 1;
    });
    return c;
  }, [marks]);

  return (
    <div className="rounded bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <span className="text-sm text-slate-500">{students.length}명</span>
        <h2 className="text-base font-semibold">{klass?.name}</h2>
        <div className="flex gap-2">
          <button
            onClick={onStartQr}
            className="flex items-center gap-1.5 rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white"
          >
            <QrCode size={14} /> QR 출결
          </button>
          <button className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white">
            <FileSpreadsheet size={14} /> 엑셀
          </button>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto border-b border-slate-200 px-4 py-3">
        {slots.slice(0, 12).map((s) => (
          <button
            key={s.id}
            onClick={() => setCurrent(s)}
            className={`shrink-0 rounded px-2.5 py-1.5 text-xs font-medium leading-tight ${
              current.id === s.id
                ? "bg-violet-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <span className="block">{s.label}</span>
            <span className="block">{s.kindLabel}</span>
          </button>
        ))}
      </div>

      {students.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-slate-500">
          학생관리 탭에서 명단을 먼저 올려주세요.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <th className="w-28 px-4 py-2 text-left font-medium">학생</th>
              <th className="w-32 px-3 py-2 text-left font-medium">출결</th>
              <th className="px-3 py-2 text-left font-medium">메모</th>
            </tr>
          </thead>
          <tbody>
            {students.map((st) => {
              const m = marks[st.student_no] || { code: "present", memo: "" };
              return (
                <tr key={st.id} className="border-b border-slate-100">
                  <td className="px-4 py-1.5">
                    <div className="font-medium">
                      {st.name || st.student_code || `${st.student_no}번`}
                    </div>
                    <div className="text-xs text-slate-400">
                      {st.student_code ? `${st.student_no}번` : klass?.name}
                      {st.user_id ? " · 연결됨" : ""}
                    </div>
                  </td>
                  <td className="px-3 py-1.5">
                    <select
                      value={m.code}
                      onChange={(e) =>
                        setCell(st.student_no, { code: e.target.value })
                      }
                      className={`w-full rounded border border-slate-200 px-2 py-1 text-sm font-medium ${codeOf(m.code).cls}`}
                    >
                      {CODES.map((c) => (
                        <option key={c.v} value={c.v}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      value={m.memo}
                      onChange={(e) =>
                        setCell(st.student_no, { memo: e.target.value })
                      }
                      className="w-full rounded border border-transparent px-2 py-1 hover:border-slate-200 focus:border-slate-300 focus:outline-none"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 px-4 py-3">
        <div className="flex flex-wrap gap-3 text-sm">
          {Object.keys(summary).length === 0 ? (
            <span className="text-slate-500">전원 출석</span>
          ) : (
            Object.entries(summary).map(([k, n]) => (
              <span key={k} className={`font-medium ${codeOf(k).cls}`}>
                {codeOf(k).label} {n}
              </span>
            ))
          )}
        </div>
        <button
          onClick={onSave}
          disabled={!dirty.size || saving}
          className="ml-auto flex items-center gap-1.5 rounded bg-yellow-400 px-5 py-2 text-sm font-semibold text-slate-900 disabled:bg-slate-200 disabled:text-slate-400"
        >
          {dirty.size ? <Save size={15} /> : <Check size={15} />}
          {saving ? "저장 중…" : dirty.size ? `저장 (${dirty.size})` : "저장됨"}
        </button>
      </div>
    </div>
  );
}

function Roster({ klass, setKlass, students, setStudents, setError }) {
  const [rows, setRows] = useState(null);
  const [noCol, setNoCol] = useState(0);
  const [nameCol, setNameCol] = useState(-1);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  async function handleFile(file) {
    try {
      const wb = XLSX.read(await file.arrayBuffer());
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
        header: 1,
        blankrows: false,
      });
      if (!data.length) return setError("첫 번째 시트가 비어 있습니다.");
      setRows(data);
      const head = (data[0] || []).map((h) => String(h ?? ""));
      const g = head.findIndex((h) => /학번|번호|번$|no/i.test(h));
      setNoCol(g >= 0 ? g : 0);
      setNameCol(-1);
    } catch {
      setError("파일을 읽지 못했습니다. xlsx 또는 csv 인지 확인해 주세요.");
    }
  }

  // 학번 열 하나만 지정하면 됩니다.
  // 반 안의 번호는 학번 뒤 두 자리에서 뽑고, 안 되면 순서대로 매깁니다.
  const parsed = useMemo(() => {
    if (!rows) return [];
    const seen = new Set();
    const out = [];
    rows.forEach((r) => {
      const code = String(r?.[noCol] ?? "").trim();
      if (!/^\d{2,10}$/.test(code) || seen.has(code)) return;
      seen.add(code);
      let no = Number(code.slice(-2));
      if (!Number.isInteger(no) || no < 1) no = out.length + 1;
      out.push({
        code,
        no,
        name: nameCol >= 0 ? String(r?.[nameCol] ?? "").trim() : "",
      });
    });
    // 반 안 번호가 겹치면 순서대로 다시 매깁니다.
    const used = new Set();
    out.forEach((s, i) => {
      if (used.has(s.no)) s.no = i + 1;
      used.add(s.no);
    });
    return out.sort((a, b) => a.code.localeCompare(b.code));
  }, [rows, noCol, nameCol]);

  const [done, setDone] = useState(null);

  async function apply() {
    setBusy(true);
    setDone(null);
    try {
      const r = await db.createStudents(klass.id, parsed);
      setStudents(await db.listStudents(klass.id));
      setRows(null);
      setDone(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded bg-white p-4 shadow-sm">
        <label className="mb-1 block text-sm font-medium text-slate-700">
          학급 이름
        </label>
        <input
          value={klass?.name || ""}
          onChange={(e) => setKlass({ ...klass, name: e.target.value })}
          onBlur={(e) => db.renameClass(klass.id, e.target.value).catch((x) => setError(x.message))}
          className="w-48 rounded border border-slate-200 px-3 py-1.5 text-sm"
        />
      </div>

      <div className="rounded bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">
          엑셀로 학생 올리기
        </h2>
        <p className="mb-3 text-sm text-slate-500">
          학번 열 하나만 있으면 됩니다. 1학년 1반 1번이면 1101 처럼 적힌 열입니다.
        </p>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
          }}
          onClick={() => fileRef.current?.click()}
          className="flex cursor-pointer flex-col items-center gap-2 rounded border-2 border-dashed border-slate-300 py-8 text-slate-500 hover:border-yellow-400 hover:bg-yellow-50"
        >
          <Upload size={22} />
          <span className="text-sm">엑셀 파일을 끌어다 놓거나 눌러서 선택</span>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
        />
      </div>

      {rows && (
        <div className="rounded bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="font-semibold text-slate-700">열 지정</span>
            <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-white">
              학번 = {noCol + 1}번째 열
            </span>
            <button
              onClick={() => setNameCol(nameCol >= 0 ? -1 : noCol + 1)}
              className={`rounded px-2 py-0.5 text-xs ${
                nameCol >= 0
                  ? "bg-yellow-400 text-slate-900"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {nameCol >= 0 ? `이름 = ${nameCol + 1}번째 열` : "이름 저장 안 함"}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="text-sm">
              <tbody>
                {rows.slice(0, 5).map((r, ri) => (
                  <tr key={ri}>
                    {r.map((cell, ci) => (
                      <td
                        key={ci}
                        onClick={() =>
                          nameCol >= 0 && ci !== noCol ? setNameCol(ci) : setNoCol(ci)
                        }
                        className={`cursor-pointer whitespace-nowrap border px-3 py-1.5 ${
                          ci === noCol
                            ? "border-slate-800 bg-slate-800 text-white"
                            : ci === nameCol
                            ? "border-yellow-400 bg-yellow-100 text-slate-900"
                            : "border-slate-200 text-slate-600"
                        }`}
                      >
                        {String(cell ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            학생 {parsed.length}명을 찾았습니다.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={apply}
              disabled={!parsed.length || busy}
              className="rounded bg-yellow-400 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-40"
            >
              {busy ? "계정 만드는 중…" : "명단 등록하고 계정 만들기"}
            </button>
            <button
              onClick={() => setRows(null)}
              className="rounded px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {done && (
        <div className="rounded bg-emerald-50 p-4 text-sm text-emerald-900 shadow-sm">
          계정 {done.created}개를 새로 만들었습니다.
          {done.existing > 0 && ` 이미 있던 계정 ${done.existing}개는 그대로 뒀습니다.`}
          {done.failed?.length > 0 && (
            <span className="mt-1 block text-rose-700">
              실패 {done.failed.length}건: {done.failed.map((f) => f.code).join(", ")}
            </span>
          )}
          <span className="mt-1 block text-emerald-800">
            학생 초기 비밀번호는 000000 입니다.
          </span>
        </div>
      )}

      <div className="rounded bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">
            등록된 학생 {students.length}명
          </h2>
          <button
            onClick={async () => {
              try {
                setStudents(await db.syncStudents(klass.id, []));
              } catch (e) {
                setError(e.message);
              }
            }}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-rose-600"
          >
            <Trash2 size={14} /> 비우기
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {students.map((s) => (
            <span
              key={s.id}
              className="rounded bg-slate-100 px-2.5 py-1 text-sm tabular-nums text-slate-700"
            >
              {s.student_code || s.student_no}
              {s.name && <span className="ml-1">{s.name}</span>}
            </span>
          ))}
          {!students.length && (
            <p className="text-sm text-slate-500">등록된 학생이 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Report({ klass, students }) {
  const [sessions, setSessions] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!klass) return;
    (async () => {
      const from = new Date();
      from.setDate(from.getDate() - 30);
      const ss = await db.listSessions(klass.id, from.toISOString().slice(0, 10));
      setSessions(ss);
      setRows(await db.listAttendance(ss.map((s) => s.id)));
      setLoading(false);
    })();
  }, [klass]);

  if (loading)
    return <div className="rounded bg-white p-12 text-center text-sm text-slate-500 shadow-sm">불러오는 중…</div>;

  if (!rows.length)
    return (
      <div className="rounded bg-white p-12 text-center text-sm text-slate-500 shadow-sm">
        최근 30일 동안 지각·결석 기록이 없습니다.
      </div>
    );

  const cols = [...sessions].reverse();
  const cell = (sid, stid) => rows.find((r) => r.session_id === sid && r.student_id === stid);

  return (
    <div className="overflow-x-auto rounded bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <th className="sticky left-0 bg-slate-50 px-4 py-2 text-left font-medium">학생</th>
            {cols.map((s) => (
              <th key={s.id} className="whitespace-nowrap px-3 py-2 text-xs font-medium">
                <span className="block">{s.on_date.slice(5).replace("-", "/")}</span>
                <span className="block text-slate-400">
                  {s.kind === "morning" ? "조회" : "종례"}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map((st) => (
            <tr key={st.id} className="border-b border-slate-100">
              <td className="sticky left-0 bg-white px-4 py-2 font-medium">
                {st.name || st.student_code || `${st.student_no}번`}
              </td>
              {cols.map((s) => {
                const r = cell(s.id, st.id);
                return (
                  <td
                    key={s.id}
                    className={`px-3 py-2 text-center text-xs font-medium ${
                      r ? codeOf(fromRow(r)).cls : "text-slate-300"
                    }`}
                  >
                    {r ? codeOf(fromRow(r)).label : "·"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
