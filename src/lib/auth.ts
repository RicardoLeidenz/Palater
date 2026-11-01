import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
};

/** The signed-in user, verified against the JWT. Redirects to /login if absent. */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login");

  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>;
  const email = typeof claims.email === "string" ? claims.email : null;
  const name =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    email?.split("@")[0] ||
    "You";

  return {
    id: claims.sub,
    name,
    email,
    avatarUrl: typeof meta.avatar_url === "string" ? meta.avatar_url : null,
  };
});
