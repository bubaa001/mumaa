"use client";

import { useMemo, useState } from "react";
import { useDesk } from "./trading-dashboard";
import { countdown, sessionAt, sessionsFrom, type Agent } from "@/lib/trader-view";

/** 12-hour clock, e.g. "3:05 PM". */
const hm = (t: number) => new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
const minuteOfDay = (t: number) => { const d = new Date(t); return d.getHours() * 60 + d.getMinutes(); };

/** Every session the bots trade in, in the viewer's own time, with how long until it opens or closes. */
export function SessionClock({ agents, limit }: { agents: Agent[]; limit?: number }) {
  const { now } = useDesk();
  const [all, setAll] = useState(false);
  const sessions = useMemo(() => sessionsFrom(agents), [agents]);
  if (!sessions.length) return null;

  const zone = now === null ? "" : Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, " ");
  const short = now === null ? "" : new Intl.DateTimeFormat("en-GB", { timeZoneName: "short" }).formatToParts(now).find((p) => p.type === "timeZoneName")?.value ?? "";
  const rows = now === null ? sessions.map((s) => ({ s, at: null })) : sessions
    .map((s) => ({ s, at: sessionAt(s, now) }))
    .sort((a, b) => Number(b.at.open) - Number(a.at.open) || a.at.next - b.at.next);
  const openCount = rows.filter((r) => r.at?.open).length;
  const nowMin = now === null ? 0 : minuteOfDay(now) + new Date(now).getSeconds() / 60;

  return (
    <section className="trade-card clock" aria-labelledby="clock-h">
      <div className="clock-head">
        <div>
          <h2 className="trade-h" id="clock-h">When the bots trade</h2>
          <p className="trade-muted">
            {now === null ? "Your local time" : `${zone} · ${short}`} · {openCount ? `${openCount} trading now` : "none trading right now"}
          </p>
        </div>
        <p className="clock-now" aria-live="off">
          {now === null ? "--:--" : hm(now).replace(/\s?[AP]M$/, "")}
          <small>{now === null ? "" : `:${String(new Date(now).getSeconds()).padStart(2, "0")} ${new Date(now).getHours() < 12 ? "AM" : "PM"}`}</small>
        </p>
      </div>

      <ul className="clock-list">
        {(limit && !all ? rows.slice(0, limit) : rows).map(({ s, at }) => {
          const segs: [number, number][] = [];
          if (at) {
            const a = minuteOfDay(at.start), len = (at.end - at.start) / 60_000;
            if (a + len <= 1440) segs.push([a, len]);
            else { segs.push([a, 1440 - a]); segs.push([0, a + len - 1440]); }
          }
          return (
            <li key={s.key} className={at?.open ? "is-open" : ""}>
              <div className="clock-row">
                <span className="clock-name">
                  <span className={`roster-dot ${at?.open ? "dot-in_trade" : "dot-stopped"}`} aria-hidden="true" />
                  <b>{s.name}</b>
                </span>
                <span className="clock-when">
                  {at === null ? "…" : at.open ? <>Open · closes in <b>{countdown(at.next - now!)}</b></> : <>Opens in <b>{countdown(at.next - now!)}</b></>}
                </span>
              </div>
              <div className="clock-sub">
                <span>{at ? `${hm(at.start)}–${hm(at.end)} your time` : s.source}</span>
                <span>{s.agents.join(" · ")}</span>
              </div>
              <div className="clock-strip" aria-hidden="true">
                {segs.map(([a, len], i) => <i key={i} style={{ left: `${(a / 1440) * 100}%`, width: `${(len / 1440) * 100}%` }} />)}
                {at && <b style={{ left: `${(nowMin / 1440) * 100}%` }} />}
              </div>
            </li>
          );
        })}
      </ul>
      {limit && rows.length > limit && (
        <button type="button" className="desk-link clock-more" onClick={() => setAll(!all)} aria-expanded={all}>
          {all ? "Show fewer" : `Show all ${rows.length} trading times`}
        </button>
      )}
      <p className="clock-scale" aria-hidden="true"><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>12 AM</span></p>
    </section>
  );
}
