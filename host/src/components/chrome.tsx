"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { prettyDate } from "@/lib/api";
import type { HostEvent } from "@/lib/types";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link className="brand" href={href}>
      <span className="dot" />
      EventDrop
    </Link>
  );
}

export function ThemeButton() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
  }, []);
  return (
    <button
      className="iconbtn"
      type="button"
      aria-label="Toggle color theme"
      onClick={() => {
        const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        if (next === "dark") document.documentElement.dataset.theme = "dark";
        else delete document.documentElement.dataset.theme;
        localStorage.setItem("theme", next);
        setDark(next === "dark");
      }}
    >
      {dark ? "Light" : "Dark"}
    </button>
  );
}

export function GuestFrame({ children }: { children: React.ReactNode }) {
  return <div className="guest">{children}</div>;
}

const links = [
  { href: "", label: "Gallery" },
  { href: "/contributors", label: "Contributors" },
  { href: "/messages", label: "Messages" },
  { href: "/downloads", label: "Downloads" },
  { href: "/settings", label: "Settings" },
  { href: "/live", label: "Live mode" },
  { href: "/share", label: "Share" },
];

export function HostFrame({ children, plain = false }: { children: React.ReactNode; plain?: boolean }) {
  const path = usePathname();
  const router = useRouter();
  const eventId = path.match(/\/host\/events\/([^/]+)/)?.[1];
  const realEvent = eventId && eventId !== "new" ? eventId : null;
  const [ready, setReady] = useState(false);
  const [event, setEvent] = useState<HostEvent | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (!data.user) router.replace("/login");
        else setReady(true);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  useEffect(() => {
    if (!ready || !realEvent) return;
    fetch(`/api/events/${realEvent}`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setEvent(data.event ?? null))
      .catch(() => setEvent(null));
  }, [ready, realEvent]);

  if (!ready) {
    return (
      <div className="guest">
        <p className="muted" style={{ padding: 24 }}>
          Loading…
        </p>
      </div>
    );
  }

  if (plain) return <div style={{ minHeight: "100dvh", background: "var(--bg)", padding: "28px 48px" }}>{children}</div>;

  const ratio = event ? Math.min(100, (event.quota.usedBytes / Math.max(1, event.quota.quotaBytes)) * 100) : 0;

  return (
    <div className="host">
      <aside className="side">
        <Logo href="/host" />
        {event ? (
          <Link className="eventcard" href={`/host/events/${event.id}`}>
            <div className={event.coverUrl ? "eventcover" : "eventcover stripes"}>
              {event.coverUrl ? <img src={event.coverUrl} alt="" /> : null}
            </div>
            <div style={{ padding: "0 4px 4px" }}>
              <b style={{ fontSize: 14 }}>{event.name}</b>
              <div className="fine">
                {prettyDate(event.eventDate) || "Event"} · <span className="mono">{event.joinCode}</span>
              </div>
            </div>
          </Link>
        ) : null}
        <nav>
          <Link className={path === "/host" ? "active" : ""} href="/host">
            <span>Events</span>
          </Link>
          {realEvent
            ? links.map((link) => {
                const href = `/host/events/${realEvent}${link.href}`;
                const active = link.href === "" ? path === href : path.startsWith(href);
                const meta =
                  link.href === "" && event
                    ? String(event.counts.photos + event.counts.videos)
                    : link.href === "/contributors" && event
                      ? String(event.counts.contributors)
                      : link.href === "/messages" && event
                        ? String(event.counts.messages)
                        : "";
                return (
                  <Link key={link.label} className={active ? "active" : ""} href={href}>
                    <span>{link.label}</span>
                    <span className="fine">{meta}</span>
                  </Link>
                );
              })
            : null}
        </nav>
        <div style={{ flex: 1 }} />
        {event ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 6px" }}>
            <div className="row" style={{ fontSize: 12 }}>
              <span style={{ fontWeight: 600 }}>Storage</span>
              <span className="fine">{event.quota.label}</span>
            </div>
            <div className="quota">
              <span style={{ width: `${ratio}%` }} />
            </div>
          </div>
        ) : null}
        <div className="row" style={{ padding: "0 6px" }}>
          <Link href="/host/events/new" style={{ fontSize: 13, fontWeight: 600 }}>
            + New event
          </Link>
          <Link href="/admin" style={{ fontSize: 13, color: "var(--mute)" }}>
            Admin
          </Link>
        </div>
        <ThemeButton />
      </aside>
      <div className="main">{children}</div>
    </div>
  );
}
