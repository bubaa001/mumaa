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
          <section className="home-hero" aria-labelledby="home-title">
            <div className="home-hero-copy">
              <p className="home-kicker">MUMAA / private archive</p>
              <h1 id="home-title">
                The life
                <br />
                <em>we&apos;re keeping.</em>
              </h1>
              <p className="home-intro">
                A quiet place for the days, words, and plans that belong to you both.
              </p>
              <div className="home-presence">
                <span className="presence-mark" aria-hidden="true" />
                <span>{displayName === "MUMAA" ? "Shared space" : `Welcome, ${displayName}`}</span>
              </div>
            </div>
            <figure className="home-hero-photo">
              <img
                src="/images/anna/anna-dearest.jpg"
                alt="Anna smiling in a light sweater and glasses"
              />
              <figcaption>
                <span>Anna / kept close</span>
                <span>01</span>
              </figcaption>
            </figure>
          </section>

          <section className="home-index" aria-labelledby="index-title">
            <div className="home-index-heading">
              <p className="home-kicker">Begin anywhere</p>
              <h2 id="index-title">What do you want to return to?</h2>
            </div>
            <nav className="home-index-links" aria-label="Archive sections">
              <a href="/memories"><span>Memories</span><strong>01</strong><i aria-hidden="true">↗</i></a>
              <a href="/diary"><span>Diary</span><strong>02</strong><i aria-hidden="true">↗</i></a>
              <a href="/events"><span>Coming moments</span><strong>03</strong><i aria-hidden="true">↗</i></a>
              <a href="/ideas"><span>Ideas for us</span><strong>04</strong><i aria-hidden="true">↗</i></a>
              <a href="/memories/graduation-2026/"><span>Graduation archive</span><strong>05</strong><i aria-hidden="true">↗</i></a>
            </nav>
          </section>

          <section className="home-memory" aria-labelledby="memory-title">
            <figure className="home-memory-photo">
              <img
                src="/images/anna/anna-soft.jpg"
                alt="Anna in a soft indoor portrait"
              />
            </figure>
            <div className="home-memory-copy">
              <p className="home-kicker">The archive begins here</p>
              <h2 id="memory-title">Keep the days that changed everything.</h2>
              <p>
                Start with the photographs, then add the details only the two of you
                would remember.
              </p>
              <a className="home-text-link" href="/memories">Open the memories <span aria-hidden="true">↗</span></a>
            </div>
          </section>
        </div>
      </FadeIn>
    </MummaaShell>
  );
}
