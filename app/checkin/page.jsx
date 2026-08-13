"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import AuthGate from "../../components/AuthGate";
import * as db from "../../lib/db";

export default function CheckinPage() {
  return (
    <AuthGate>
      <Suspense fallback={<Shell state="loading" text="불러오는 중…" />}>
        <Checkin />
      </Suspense>
    </AuthGate>
  );
}

function Checkin() {
  const params = useSearchParams();
  const token = params.get("t");
  const [state, setState] = useState("loading");
  const [text, setText] = useState("출결 확인 중…");

  useEffect(() => {
    if (!token) {
      setState("error");
      setText("QR 주소가 올바르지 않습니다.");
      return;
    }
    db.checkIn(token)
      .then((r) => {
        setState("ok");
        setText(r.already ? "이미 출석 처리되어 있습니다." : "출석되었습니다.");
      })
      .catch((e) => {
        setState("error");
        setText(e.message || "출석 처리에 실패했습니다.");
      });
  }, [token]);

  return <Shell state={state} text={text} />;
}

function Shell({ state, text }) {
  const tone =
    state === "ok"
      ? { bg: "bg-emerald-500", Icon: CheckCircle2 }
      : state === "error"
      ? { bg: "bg-rose-500", Icon: XCircle }
      : { bg: "bg-slate-400", Icon: Loader2 };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-6">
      <div
        className={`flex h-24 w-24 items-center justify-center rounded-full ${tone.bg}`}
      >
        <tone.Icon
          size={52}
          className={`text-white ${state === "loading" ? "animate-spin" : ""}`}
        />
      </div>

      <p className="mt-6 text-center text-lg font-semibold text-slate-900">
        {text}
      </p>

      {state === "error" && (
        <p className="mt-2 text-center text-sm text-slate-500">
          QR 은 몇 초마다 바뀝니다. 교실 화면을 다시 찍어주세요.
        </p>
      )}

      <a
        href="/"
        className="mt-8 rounded bg-slate-800 px-6 py-2.5 text-sm font-medium text-white"
      >
        내 출결 보기
      </a>
    </div>
  );
}
