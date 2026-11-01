import { serverEnv } from "@/lib/env";
import { safeNextPath } from "@/lib/safe-redirect";
import { Logo } from "@/components/logo";
import { GoogleButton } from "./google-button";
import { DevLogin } from "./dev-login";

const ERRORS: Record<string, string> = {
  auth: "Sign-in didn't go through. Please try again.",
  dev: "That demo account couldn't sign in. Did you run the seed?",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
      <Logo className="text-4xl" />
      <h1 className="display mt-8 mb-3">
        Remember every <em className="text-plum">plate</em>.
      </h1>
      <p className="text-muted mb-8">
        Save the restaurants you visit and rate the dishes you eat. Your scores, notes and photos
        are yours alone. Nobody else can see them.
      </p>

      {error && (
        <p role="alert" className="text-terracotta mb-4 text-sm">
          {error}
        </p>
      )}

      <GoogleButton next={next} />

      {serverEnv().ENABLE_DEV_LOGIN && <DevLogin next={next} />}
    </main>
  );
}
