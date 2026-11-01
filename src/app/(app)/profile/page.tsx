import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getStats, getTopDishes } from "@/lib/lists";
import { ScoreBadge } from "@/components/score-badge";
import { EmptyState } from "@/components/states";

export default async function ProfilePage() {
  const [user, stats, top] = await Promise.all([getCurrentUser(), getStats(), getTopDishes(5)]);

  return (
    <section className="max-w-2xl">
      <div className="eyebrow">Profile</div>
      <h1 className="display mt-1.5 mb-2">{user.name}</h1>
      {user.email && <p className="text-muted mb-8">{user.email}</p>}

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Restaurants" value={stats.restaurantsVisited} />
        <Tile label="Dishes rated" value={stats.dishesRated} />
        <Tile label="Average score" value={stats.avgScore ?? "–"} />
        <Tile label="Plate photos" value={stats.photos} />
      </div>

      <div className="mb-1 border-b border-espresso pb-2">
        <h2 className="font-serif text-[26px]">Your best dishes</h2>
      </div>
      {top.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="Nothing rated yet">Your favourite plates will show up here.</EmptyState>
        </div>
      ) : (
        <ol className="mb-10">
          {top.map((d) => (
            <li key={d.dishId} className="border-line border-b border-dashed">
              <Link href={`/r/${d.restaurantId}`} className="flex items-center gap-4 py-4 no-underline">
                <div className="min-w-0 flex-1">
                  <h3 className="text-[17px] font-semibold">{d.dishName}</h3>
                  <p className="text-muted text-sm">{d.restaurantName}</p>
                  {d.note && <p className="text-plum mt-1 font-serif text-[15px] italic">“{d.note}”</p>}
                </div>
                <ScoreBadge score={d.score} />
              </Link>
            </li>
          ))}
        </ol>
      )}

      <div className="card my-6">
        <h2 className="mb-1 font-serif text-xl">Your ratings are private</h2>
        <p className="text-muted text-sm">
          Scores, comments, photos and your want-to-try list are visible only to you. The only things you share
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

function Tile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card p-4 text-center">
      <b className="text-plum block font-serif text-3xl font-semibold">{value}</b>
      <span className="text-muted text-xs tracking-[0.06em] uppercase">{label}</span>
    </div>
  );
}
