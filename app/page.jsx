"use client";

import { useEffect, useState } from "react";
import AuthGate from "../components/AuthGate";
import AttendanceApp from "../components/AttendanceApp";
import StudentApp from "../components/StudentApp";
import MasterApp from "../components/MasterApp";
import * as db from "../lib/db";

export default function Page() {
  return (
    <AuthGate>
      <Router />
    </AuthGate>
  );
}

function Router() {
  const [who, setWho] = useState(undefined);

  useEffect(() => {
    (async () => {
      try {
        const profile = await db.getMyProfile();
        if (profile?.role === "master") return setWho({ kind: "master" });
        if (profile?.role === "teacher") return setWho({ kind: "teacher" });

        const student = await db.getMyStudent();
        if (student) return setWho({ kind: "student", student });

        // 역할이 없는 계정 (예전에 만든 선생님 계정)
        setWho({ kind: "teacher" });
      } catch {
        setWho({ kind: "teacher" });
      }
    })();
  }, []);

  if (who === undefined)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500">
        불러오는 중…
      </div>
    );

  if (who.kind === "master") return <MasterApp />;
  if (who.kind === "student") return <StudentApp me={who.student} />;
  return <AttendanceApp />;
}
