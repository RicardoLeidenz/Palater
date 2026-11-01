import { getCurrentUser } from "@/lib/auth";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  return (
    <section className="max-w-xl">
      <div className="eyebrow">Profile</div>
      <h1 className="display mt-1.5 mb-2">{user.name}</h1>
      {user.email && <p className="text-muted mb-8">{user.email}</p>}

      <div className="card mb-6">
        <h2 className="mb-1 font-serif text-xl">Your ratings are private</h2>
        <p className="text-muted text-sm">
          Scores, notes and plate photos are visible only to you. The only things you share
          are restaurants and dish names on the menu.
        </p>
      </div>

      <form action="/auth/signout" method="post">
        <button type="submit" className="btn">
          Sign out
        </button>
      </form>
    </section>
  );
}
