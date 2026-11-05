import type { Metadata } from "next";
import { serverEnv } from "@/lib/env";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Privacy · Palater" };

// Public (listed in PUBLIC_PATHS in src/proxy.ts) because Google's OAuth consent screen links here.
export default function PrivacyPage() {
  // The contact address comes from the environment so it never lives in the public repo.
  const contact = serverEnv().OSM_CONTACT_EMAIL;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Logo className="text-3xl" />
      <h1 className="display mt-8 mb-2">Privacy</h1>
      <p className="text-muted mb-8 text-sm">Last updated November 5, 2026</p>

      <div className="space-y-8 leading-relaxed [&_h2]:mb-2 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:text-plum [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
        <section>
          <h2>The short version</h2>
          <p>
            Palater is a personal project for remembering the dishes you eat. Your scores, comments, photos and
            want-to-try list are private to you. There are no ads, no analytics and no tracking, and your data is never
            sold.
          </p>
        </section>

        <section>
          <h2>What we store</h2>
          <ul>
            <li>
              <strong>Your Google account basics:</strong> your name, email address and profile picture, used only to
              sign you in and show your profile.
            </li>
            <li>
              <strong>Private to you:</strong> your dish scores and rating history, comments, plate photos and
              want-to-try list. Other users can&apos;t see them, and neither can the app&apos;s moderators. This is
              enforced by the database itself, not just the screen.
            </li>
            <li>
              <strong>Shared with everyone:</strong> restaurants and dish names you add, since menus are built by the
              community. Your name isn&apos;t shown next to them.
            </li>
            <li>
              <strong>Reports:</strong> if you report a dish name, a moderator sees the report so they can fix the menu.
            </li>
          </ul>
        </section>

        <section>
          <h2>Photos and location</h2>
          <ul>
            <li>
              Photos are resized on your phone before upload, and all metadata (including GPS location) is stripped.
              They&apos;re stored privately and only shown to you through short-lived links.
            </li>
            <li>
              If you use &quot;near me&quot;, your location is rounded to about 110 meters and saved only in a cookie on
              your device to find nearby restaurants.
            </li>
          </ul>
        </section>

        <section>
          <h2>Services we use</h2>
          <ul>
            <li>
              <strong>Supabase</strong> stores the database, sign-in and photos.
            </li>
            <li>
              <strong>Netlify</strong> hosts the website.
            </li>
            <li>
              <strong>Google</strong> handles sign-in.
            </li>
            <li>
              <strong>OpenStreetMap</strong> services (Photon and Nominatim) power restaurant search and the map. They
              receive your search terms and rounded location, never your account details.
            </li>
          </ul>
        </section>

        <section>
          <h2>Cookies</h2>
          <p>
            Palater uses only the cookies it needs to keep you signed in and to remember your chosen search location.
          </p>
        </section>

        <section>
          <h2>Deleting your data</h2>
          <p>
            Your data is kept until you ask for it to be removed. To delete your account and everything private in it,
            email{" "}
            <a className="text-terracotta" href={`mailto:${contact}`}>
              {contact}
            </a>{" "}
            from the address you sign in with.
          </p>
        </section>
      </div>
    </main>
  );
}
