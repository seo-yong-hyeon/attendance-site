"use client";

import AuthGate from "../components/AuthGate";
import AttendanceApp from "../components/AttendanceApp";

export default function Page() {
  return (
    <AuthGate>
      <AttendanceApp />
    </AuthGate>
  );
}
