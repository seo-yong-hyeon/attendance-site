"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PythonPlayground from "./PythonPlayground";
import PlacementApp from "./placement/PlacementApp";

// 로그인 없이 누구나 쓰는 도구 모음입니다.
// 새 도구가 생기면 이 배열에 하나 추가하면 탭이 자동으로 생깁니다.
const TOOLS = [
  { id: "python", label: "파이썬 실행", Comp: PythonPlayground },
  { id: "placement", label: "반편성", Comp: PlacementApp },
];

export default function PublicTools() {
  return (
    <Suspense fallback={null}>
      <Tools />
    </Suspense>
  );
}

function Tools() {
  const params = useSearchParams();
  const router = useRouter();
  const initial = TOOLS.find((t) => t.id === params.get("tab"))?.id || TOOLS[0].id;
  const [tab, setTab] = useState(initial);

  function select(id) {
    setTab(id);
    router.replace(`/tools?tab=${id}`, { scroll: false });
  }

  const Active = TOOLS.find((t) => t.id === tab)?.Comp || TOOLS[0].Comp;

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-slate-800">
        <div className="mx-auto flex max-w-3xl items-center px-5 pt-4">
          <h1 className="text-lg font-semibold text-white">세연중학교 도구</h1>
        </div>
        <nav className="mx-auto flex max-w-3xl gap-6 px-5 pt-3">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => select(t.id)}
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

      <Active />
    </div>
  );
}
