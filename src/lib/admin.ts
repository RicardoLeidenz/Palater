import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Reads your own profile row (RLS) to see whether you're an admin. */
export const isAdmin = cache(async (): Promise<boolean> => {
  const user = await getCurrentUser();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  return data?.is_admin === true;
});

/** 404 for non-admins, so the admin area isn't even discoverable. */
export async function requireAdmin() {
  if (!(await isAdmin())) notFound();
}
