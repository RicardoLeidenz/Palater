import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  return (
    <>
      <Header initial={user.name.charAt(0).toUpperCase()} />
      <main className="mx-auto max-w-[1080px] px-4 pt-7 pb-16">{children}</main>
    </>
  );
}
