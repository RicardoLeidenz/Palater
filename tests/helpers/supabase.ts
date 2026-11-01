import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function serviceClient() {
  return createClient(url(), process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function anonClient() {
  return createClient(url(), anonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type TestUser = { id: string; email: string; client: SupabaseClient };

/** Creates a throwaway user and returns a client signed in as them (RLS applies). */
export async function createTestUser(opts: { admin?: boolean } = {}): Promise<TestUser> {
  const admin = serviceClient();
  const email = `test-${randomUUID()}@test.palater.local`;
  const password = `pw-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Test User" },
  });
  if (error) throw error;
  if (opts.admin) {
    await admin.from("profiles").update({ is_admin: true }).eq("id", data.user.id).throwOnError();
  }

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, email, client };
}

export async function deleteTestUser(user: TestUser | undefined) {
  if (!user) return;
  const admin = serviceClient();
  const { data } = await admin.storage.from("plate-photos").list(user.id, { limit: 1000 });
  for (const folder of data ?? []) {
    const { data: files } = await admin.storage.from("plate-photos").list(`${user.id}/${folder.name}`);
    const paths = (files ?? []).map((f) => `${user.id}/${folder.name}/${f.name}`);
    if (paths.length) await admin.storage.from("plate-photos").remove(paths);
  }
  await admin.auth.admin.deleteUser(user.id);
}

/** A seeded restaurant + dish to attach private data to. */
export async function createTestDish(owner: TestUser) {
  const { data: restaurant } = await owner.client
    .from("restaurants")
    .insert({ source: "user", name: `Test Kitchen ${randomUUID().slice(0, 8)}`, created_by: owner.id })
    .select()
    .single()
    .throwOnError();
  const { data: dish } = await owner.client
    .from("dishes")
    .insert({ restaurant_id: restaurant!.id, name: `Test dish ${randomUUID().slice(0, 8)}`, created_by: owner.id })
    .select()
    .single()
    .throwOnError();
  return { restaurant: restaurant!, dish: dish! };
}

// Smallest valid WebP (1×1), enough for the bucket's MIME check.
export const TINY_WEBP = Buffer.from(
  "UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==",
  "base64",
);
