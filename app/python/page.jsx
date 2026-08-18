import { redirect } from "next/navigation";

export default function PythonPage() {
  redirect("/tools?tab=python");
}
