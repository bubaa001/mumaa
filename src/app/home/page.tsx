import { redirect } from "next/navigation";
import { FadeIn, MummaaShell } from "@/components/mumaa-shell";
import { cookies } from "next/headers";
import { readAuthSession } from "@/lib/auth/session";

export default async function PrivateHomePage() {
  const token = (await cookies()).get("mumaa_session")?.value;
  const session = await readAuthSession(token);
  if (!session) redirect("/login");
  return <PrivateHomeContent displayName={session.name} />;
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

          <section className="graduation-story" aria-labelledby="graduation-title">
            <div className="graduation-story-intro">
              <p className="home-kicker">A day worth keeping</p>
              <h2 id="graduation-title">Anna&apos;s graduation.</h2>
              <p>
                The flowers, the bright room, the people who showed up, and the moment
                she stepped into everything she had worked for.
              </p>
            </div>
            <div className="graduation-gallery">
              <figure className="graduation-photo graduation-photo-feature">
                <img
                  src="/images/anna/graduation/anna-graduation-portrait.jpg"
                  alt="Anna standing in her graduation suit"
                />
                <figcaption>Class of 2025</figcaption>
              </figure>
              <figure className="graduation-photo graduation-photo-bouquet">
                <img
                  src="/images/anna/graduation/anna-graduation-bouquet.jpg"
                  alt="Anna holding her graduation bouquet"
                />
                <figcaption>She did it.</figcaption>
              </figure>
              <figure className="graduation-photo graduation-photo-family">
                <img
                  src="/images/anna/graduation/anna-graduation-family.jpg"
                  alt="Anna celebrating graduation with her family"
                />
                <figcaption>The people who made the day brighter.</figcaption>
              </figure>
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
