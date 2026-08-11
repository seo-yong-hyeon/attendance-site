import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL 과 NEXT_PUBLIC_SUPABASE_ANON_KEY 를 .env.local 에 넣어주세요."
  );
}

export const supabase = createClient(url, key);
