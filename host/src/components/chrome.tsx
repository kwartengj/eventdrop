"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
  return (
    <div className="guest">
      <div className="toprow">
        <Logo />
        <ThemeButton />
      </div>
      {children}
    </div>
  );
}

const links = [
  { href: "", label: "Gallery" },
  { href: "/contributors", label: "Contributors" },
  { href: "/downloads", label: "Downloads" },
  { href: "/settings", label: "Settings" },
  { href: "/live", label: "Live" },
  { href: "/share", label: "Share" },
  { href: "/poster", label: "Poster" },
];

export function HostFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const eventId = path.match(/\/host\/events\/([^/]+)/)?.[1];
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (!data.user) router.replace("/login");
        else setReady(true);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  if (!ready) {
    return (
      <div className="guest">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="host">
      <aside className="side">
        <Logo href="/host" />
        <nav>
          <Link className={path === "/host" ? "active" : ""} href="/host">
            Events
          </Link>
          {eventId
            ? links.map((link) => {
                const href = `/host/events/${eventId}${link.href}`;
                const active = link.href === "" ? path === href : path.startsWith(href);
                return (
                  <Link key={link.label} className={active ? "active" : ""} href={href}>
                    {link.label}
                  </Link>
                );
              })
            : null}
          <Link href="/admin">Admin</Link>
        </nav>
        <div style={{ marginTop: "auto" }}>
          <ThemeButton />
        </div>
      </aside>
      <div className="main">{children}</div>
    </div>
  );
}
