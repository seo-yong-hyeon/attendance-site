"use client";

import { getSortedValidClasses, parseClassKey } from "./placementModel";

const PREV_CLASS_TINTS = [
  "bg-red-50",
  "bg-orange-50",
  "bg-amber-50",
  "bg-yellow-50",
  "bg-lime-50",
  "bg-green-50",
  "bg-emerald-50",
  "bg-teal-50",
  "bg-cyan-50",
  "bg-sky-50",
  "bg-blue-50",
  "bg-indigo-50",
  "bg-violet-50",
  "bg-purple-50",
  "bg-pink-50",
];

function prevClassTint(prevClass) {
  const n = parseInt(prevClass, 10);
  if (!Number.isFinite(n) || n < 1) return "";
  return PREV_CLASS_TINTS[(n - 1) % PREV_CLASS_TINTS.length];
}

function isSelected(selectedStudents, cls, index) {
  return selectedStudents.some((s) => s.cls === cls && s.index === index);
}

/* ── 보기 옵션 컨트롤 ─────────────────────────────── */

export function ViewOptionsBar({ viewOptions, onChange }) {
  const set = (patch) => onChange({ ...viewOptions, ...patch });

  const pill = (active) =>
    `rounded-full border px-2.5 py-1 text-xs font-medium transition ${
      active
        ? "border-slate-800 bg-slate-800 text-white"
        : "border-slate-200 text-slate-500 hover:border-slate-300"
    }`;

  const check = (active) =>
    `rounded-full border px-2.5 py-1 text-xs font-medium transition ${
      active
        ? "border-emerald-600 bg-emerald-50 text-emerald-700"
        : "border-slate-200 text-slate-500 hover:border-slate-300"
    }`;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded bg-white px-3 py-2 text-sm shadow-sm">
      <span className="text-slate-500">보기옵션</span>

      <span className="ml-1 text-xs text-slate-400">글자크기</span>
      <button
        className={pill(false)}
        onClick={() => set({ fontScale: Math.max(0.7, +(viewOptions.fontScale - 0.1).toFixed(1)) })}
      >
        −
      </button>
      <button
        className={pill(false)}
        onClick={() => set({ fontScale: Math.min(1.8, +(viewOptions.fontScale + 0.1).toFixed(1)) })}
      >
        +
      </button>

      <span className="ml-2 text-xs text-slate-400">그리드</span>
      {[2, 3, 4].map((n) => (
        <button
          key={n}
          className={pill(viewOptions.gridColumns === n)}
          onClick={() => set({ gridColumns: n })}
        >
          {n}
        </button>
      ))}

      <span className="ml-2 text-xs text-slate-400">표시</span>
      <button className={check(viewOptions.showStats)} onClick={() => set({ showStats: !viewOptions.showStats })}>
        통계
      </button>
      <button
        className={check(viewOptions.showBirthdate)}
        onClick={() => set({ showBirthdate: !viewOptions.showBirthdate })}
      >
        생년월일
      </button>
      <button className={check(viewOptions.showGender)} onClick={() => set({ showGender: !viewOptions.showGender })}>
        성별
      </button>
      <button
        className={check(viewOptions.showSpecial)}
        onClick={() => set({ showSpecial: !viewOptions.showSpecial })}
      >
        메모
      </button>
    </div>
  );
}

/* ── 통계 테이블 ──────────────────────────────────── */

export function StatsTable({ classData, violationsByClass = {}, onShowTooltip, onHideTooltip }) {
  const validClasses = getSortedValidClasses(classData);
  if (validClasses.length === 0) {
    return <p className="rounded bg-white px-4 py-8 text-center text-sm text-slate-400 shadow-sm">데이터가 없습니다.</p>;
  }

  let prevMax = 0;
  validClasses.forEach((cls) => {
    (classData[cls] || []).forEach((s) => {
      const v = parseInt(s.이전학적반, 10);
      if (!isNaN(v)) prevMax = Math.max(prevMax, v);
    });
  });
  prevMax = Math.max(prevMax, 1);

  const stats = {};
  validClasses.forEach((cls) => {
    const students = classData[cls];
    let totalScore = 0;
    let maxScore = -Infinity;
    let minScore = Infinity;
    let maxStudent = "";
    let minStudent = "";
    let maleCount = 0;
    let femaleCount = 0;
    const previousClassCount = Array(prevMax).fill(0);

    students.forEach((s) => {
      const score = parseFloat(s.기준성적) || 0;
      if (score > maxScore) {
        maxScore = score;
        maxStudent = s.성명;
      }
      if (score < minScore) {
        minScore = score;
        minStudent = s.성명;
      }
      totalScore += score;
      if (s.성별 === "남") maleCount++;
      else if (s.성별 === "여") femaleCount++;

      const prevClass = parseInt(s.이전학적반, 10) - 1;
      if (!isNaN(prevClass) && prevClass >= 0 && prevClass < prevMax) previousClassCount[prevClass]++;
    });

    stats[cls] = {
      studentCount: students.length,
      maleCount,
      femaleCount,
      avgScore: students.length ? (totalScore / students.length).toFixed(2) : "-",
      maxScore: maxScore !== -Infinity ? maxScore : "-",
      maxStudent,
      minScore: minScore !== Infinity ? minScore : "-",
      minStudent,
      previousClassCount,
    };
  });

  const violationTint = (count) => {
    if (count >= 5) return "bg-red-600 text-white";
    if (count >= 4) return "bg-red-400 text-white";
    if (count >= 3) return "bg-red-300";
    if (count >= 2) return "bg-red-200";
    if (count >= 1) return "bg-red-100";
    return "";
  };

  return (
    <div className="overflow-x-auto rounded bg-white shadow-sm">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
            <th className="px-3 py-2 font-medium">구분</th>
            <th className="px-3 py-2 font-medium">인원</th>
            <th className="px-3 py-2 font-medium">남</th>
            <th className="px-3 py-2 font-medium">여</th>
            {Array.from({ length: prevMax }, (_, i) => (
              <th key={i} className="px-3 py-2 font-medium">
                이전 {i + 1}반
              </th>
            ))}
            <th className="px-3 py-2 font-medium">성적 평균</th>
            <th className="px-3 py-2 font-medium">최고점(이름)</th>
            <th className="px-3 py-2 font-medium">최저점(이름)</th>
          </tr>
        </thead>
        <tbody>
          {validClasses.map((cls) => {
            const s = stats[cls];
            const maxCount = Math.max(...s.previousClassCount);
            const minCount = Math.min(...s.previousClassCount);
            const violationCount = violationsByClass[cls] || 0;
            return (
              <tr key={cls} className="border-b border-slate-100 last:border-0">
                <td
                  className={`px-3 py-2 font-medium ${violationTint(violationCount)}`}
                  style={violationCount > 0 ? { cursor: "help" } : undefined}
                  onMouseEnter={violationCount > 0 ? (e) => onShowTooltip?.(cls, e) : undefined}
                  onMouseLeave={violationCount > 0 ? onHideTooltip : undefined}
                >
                  {cls}
                  {violationCount > 0 && ` 🚨${violationCount}`}
                </td>
                <td className="px-3 py-2">{s.studentCount}</td>
                <td className="px-3 py-2">{s.maleCount}</td>
                <td className="px-3 py-2">{s.femaleCount}</td>
                {s.previousClassCount.map((count, i) => {
                  const isUniqueMax = count === maxCount && s.previousClassCount.filter((c) => c === maxCount).length === 1;
                  const isUniqueMin = count === minCount && s.previousClassCount.filter((c) => c === minCount).length === 1;
                  return (
                    <td
                      key={i}
                      className={`px-3 py-2 ${isUniqueMax ? "bg-rose-100" : isUniqueMin ? "bg-blue-100" : ""}`}
                    >
                      {count}
                    </td>
                  );
                })}
                <td className="px-3 py-2 tabular-nums">{s.avgScore}</td>
                <td className="px-3 py-2">{s.maxScore !== "-" ? `${s.maxScore} (${s.maxStudent})` : "-"}</td>
                <td className="px-3 py-2">{s.minScore !== "-" ? `${s.minScore} (${s.minStudent})` : "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── 반별 카드 + 학생 테이블 ──────────────────────── */

function ClassCard({
  cls,
  students,
  viewOptions,
  selectedStudents,
  changedStudents,
  movedStudents,
  onSelect,
  onMemoChange,
  onSwap,
  onMove,
  onUndo,
  canSwap,
  canMove,
  canUndo,
}) {
  const { classNum } = parseClassKey(cls);
  const cellStyle = { fontSize: `${13 * viewOptions.fontScale}px` };
  const rowStyle = { height: `${26 * viewOptions.fontScale}px` };

  return (
    <div className="overflow-hidden rounded bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
        <h3 className="text-sm font-semibold text-slate-800">{classNum}반</h3>
        <span className="text-xs text-slate-500">{students.length}명</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={cellStyle}>
          <thead>
            <tr className="bg-slate-50 text-slate-500">
              <th className="px-2 py-1 font-medium">번호</th>
              <th className="px-2 py-1 font-medium">성명</th>
              {viewOptions.showBirthdate && <th className="px-2 py-1 font-medium">생년월일</th>}
              {viewOptions.showGender && <th className="px-2 py-1 font-medium">성별</th>}
              <th className="px-2 py-1 font-medium">기준성적</th>
              <th className="px-2 py-1 font-medium">이전학년</th>
              <th className="px-2 py-1 font-medium">이전반</th>
              <th className="px-2 py-1 font-medium">이전번호</th>
              {viewOptions.showSpecial && <th className="px-2 py-1 font-medium">메모</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {students.map((student, index) => {
              const key = `${cls}-${student.성명}`;
              const selected = isSelected(selectedStudents, cls, index);
              const rowTint = selected
                ? "bg-yellow-100"
                : changedStudents.has(key)
                ? "bg-amber-50"
                : movedStudents.has(key)
                ? "bg-emerald-50"
                : "";
              return (
                <tr
                  key={index}
                  style={rowStyle}
                  className={`cursor-pointer ${rowTint} hover:bg-slate-50`}
                  onClick={() => onSelect(cls, index)}
                >
                  <td className="px-2 py-1">{student.번호}</td>
                  <td className="px-2 py-1 font-medium">{student.성명}</td>
                  {viewOptions.showBirthdate && <td className="px-2 py-1 text-slate-500">{student.생년월일}</td>}
                  {viewOptions.showGender && (
                    <td className={`px-2 py-1 ${student.성별 === "남" ? "text-blue-500" : "text-rose-500"}`}>
                      {student.성별}
                    </td>
                  )}
                  <td className="px-2 py-1 tabular-nums text-slate-500">{student.기준성적}</td>
                  <td className="px-2 py-1 text-slate-400">{student.이전학적학년 || ""}</td>
                  <td className={`px-2 py-1 font-semibold ${prevClassTint(student.이전학적반)}`}>
                    {student.이전학적반 || ""}
                  </td>
                  <td className="px-2 py-1 text-slate-400">{student.이전학적번호 || ""}</td>
                  {viewOptions.showSpecial && (
                    <td className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        defaultValue={student.특이사항 || ""}
                        onChange={(e) => onMemoChange(cls, index, e.target.value)}
                        className="w-24 rounded border border-slate-200 px-1 py-0.5 text-xs"
                      />
                    </td>
                  )}
                </tr>
              );
            })}
            {students.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-xs text-slate-400">
                  비어 있음
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex gap-1.5 border-t border-slate-100 px-3 py-2">
        <button
          onClick={onSwap}
          disabled={!canSwap}
          className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white disabled:bg-slate-200 disabled:text-slate-400"
        >
          바꾸기
        </button>
        <button
          onClick={onMove}
          disabled={!canMove}
          className="rounded bg-violet-600 px-2.5 py-1 text-xs font-medium text-white disabled:bg-slate-200 disabled:text-slate-400"
        >
          다른 반 이동
        </button>
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-600 disabled:opacity-40"
        >
          되돌리기
        </button>
      </div>
    </div>
  );
}

export default function ClassBoard({
  classData,
  viewOptions,
  selectedStudents,
  changedStudents,
  movedStudents,
  onSelect,
  onMemoChange,
  onSwap,
  onMove,
  onUndo,
  canSwap,
  canMove,
  canUndo,
}) {
  const validClasses = getSortedValidClasses(classData);

  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(${viewOptions.gridColumns}, minmax(280px, 1fr))` }}
    >
      {validClasses.map((cls) => (
        <ClassCard
          key={cls}
          cls={cls}
          students={classData[cls] || []}
          viewOptions={viewOptions}
          selectedStudents={selectedStudents}
          changedStudents={changedStudents}
          movedStudents={movedStudents}
          onSelect={onSelect}
          onMemoChange={onMemoChange}
          onSwap={onSwap}
          onMove={onMove}
          onUndo={onUndo}
          canSwap={canSwap}
          canMove={canMove}
          canUndo={canUndo}
        />
      ))}
    </div>
  );
}
