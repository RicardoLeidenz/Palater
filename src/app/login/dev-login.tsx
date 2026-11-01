import { redirect } from "next/navigation";
import { serverEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-redirect";

// Seeded by `npm run seed`. Development only.
const DEMO_USERS = [
  { email: "ana@demo.palater.local", label: "Ana (demo)" },
  { email: "ben@demo.palater.local", label: "Ben (demo)" },
];

async function devSignIn(formData: FormData) {
  "use server";
  if (!serverEnv().ENABLE_DEV_LOGIN) throw new Error("Dev login is disabled");

  const email = String(formData.get("email"));
  const next = safeNextPath(String(formData.get("next")));
  if (!DEMO_USERS.some((u) => u.email === email)) throw new Error("Unknown demo user");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: serverEnv().DEMO_USER_PASSWORD,
  });
  redirect(error ? "/login?error=dev" : next);
}

export function DevLogin({ next }: { next: string }) {
  return (
    <div className="border-line mt-10 border-t border-dashed pt-6">
      <p className="eyebrow mb-3">Development only</p>
      <div className="flex flex-wrap gap-2">
        {DEMO_USERS.map((u) => (
          <form key={u.email} action={devSignIn}>
            <input type="hidden" name="email" value={u.email} />
            <input type="hidden" name="next" value={next} />
            <button type="submit" className="btn">
              Sign in as {u.label}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
