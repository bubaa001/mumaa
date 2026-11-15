import { redirect } from "next/navigation";
import { FadeIn, MummaaShell } from "@/components/mumaa-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function PrivateHomePage() {
  if (!isSupabaseConfigured()) {
    return <PrivateHomeContent displayName="MUMAA" />;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  return <PrivateHomeContent displayName={user.user_metadata?.full_name ?? "MUMAA"} />;
}

function PrivateHomeContent({ displayName }: { displayName: string }) {
  return (
    <MummaaShell>
      <FadeIn>
        <div className="private-home">
          <section className="home-welcome">
            <div>
              <p className="home-kicker">Welcome back</p>
              <h1>
                Good things
                <br />
                <em>live here.</em>
              </h1>
              <p className="home-intro">
                A private place for the life you are making together.
              </p>
            </div>
            <div className="presence-note">
              <span className="presence-mark" aria-hidden="true" />
              <span>{displayName === "MUMAA" ? "Your shared space" : `Welcome, ${displayName}`}</span>
            </div>
          </section>

          <section className="home-feature">
            <div className="home-feature-image" role="img" aria-label="A calm blue-hour landscape" />
            <div className="home-feature-copy">
              <p className="home-kicker">Your archive</p>
              <h2>The first chapter is waiting.</h2>
              <p>
                Begin with a memory, a note, or something you want to remember later.
              </p>
              <a href="/memories">Open memories <span aria-hidden="true">↗</span></a>
            </div>
          </section>

          <section className="home-grid">
            <article className="home-journal">
              <p className="home-kicker">Our diary</p>
              <h2>Write something worth returning to.</h2>
              <p>No entries yet. The page is ready for the first one.</p>
              <a href="/diary">Open diary <span aria-hidden="true">↗</span></a>
            </article>
            <article className="home-moment">
              <p className="home-kicker">Coming moments</p>
              <div className="empty-date">--</div>
              <h2>Make room for what comes next.</h2>
              <a href="/events">Add an event <span aria-hidden="true">↗</span></a>
            </article>
            <article className="home-ideas">
              <p className="home-kicker">Our ideas</p>
              <h2>Build the future together.</h2>
              <p>Your shared list is still open.</p>
              <a href="/ideas">See ideas <span aria-hidden="true">↗</span></a>
            </article>
          </section>
        </div>
      </FadeIn>
    </MummaaShell>
  );
}
