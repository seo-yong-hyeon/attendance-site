// 화면에서는 드롭다운 하나로 고르고, DB 에는 NEIS 형식대로
// status(출결 구분) 와 reason(사유) 을 나눠 저장합니다.

export const CODES = [
  { v: "present", label: "출석", cls: "text-blue-600", status: "present", reason: null },
  { v: "late", label: "지각", cls: "text-orange-500", status: "late", reason: "unauthorized" },
  { v: "late_sick", label: "병지각", cls: "text-orange-500", status: "late", reason: "illness" },
  { v: "early", label: "조퇴", cls: "text-orange-600", status: "early_leave", reason: "unauthorized" },
  { v: "partial", label: "결과", cls: "text-orange-600", status: "partial", reason: "unauthorized" },
  { v: "sick", label: "병결", cls: "text-violet-600", status: "absent", reason: "illness" },
  { v: "excused", label: "공결", cls: "text-violet-600", status: "absent", reason: "authorized" },
  { v: "unexcused", label: "무단결석", cls: "text-rose-600", status: "absent", reason: "unauthorized" },
  { v: "other", label: "기타결석", cls: "text-rose-600", status: "absent", reason: "other" },
];

export const codeOf = (v) => CODES.find((c) => c.v === v) || CODES[0];

export function toRow(code) {
  const c = codeOf(code);
  return { status: c.status, reason: c.reason };
}

export function fromRow(row) {
  if (!row) return "present";
  const hit = CODES.find(
    (c) => c.status === row.status && c.reason === (row.reason ?? null)
  );
  // 사유가 비어 있는 옛 기록은 같은 status 의 첫 코드로 떨어뜨립니다.
  return hit?.v || CODES.find((c) => c.status === row.status)?.v || "present";
}
