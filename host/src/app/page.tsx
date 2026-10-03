"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GuestFrame, Logo, ThemeButton } from "@/components/chrome";

export default function EnterCodePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const ready = code.replace(/[^A-Z0-9]/g, "").length >= 6;

  return (
    <GuestFrame>
      <div className="guest-pad" style={{ gap: 28 }}>
        <div className="row">
          <Logo />
          <ThemeButton />
        </div>
        <div className="stack" style={{ marginTop: 40, gap: 10 }}>
          <h1>Join an event</h1>
          <p className="lede">Enter the 6-character code from the invite or poster.</p>
        </div>
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            const next = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
            if (next.length >= 6) router.push(`/e/${next}`);
          }}
        >
          <input
            className="code"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={6}
            placeholder="ABC123"
            aria-label="Event code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
          />
          <button className="btn block" type="submit" disabled={!ready} style={{ fontSize: 18, padding: 19 }}>
            Join event
          </button>
        </form>
        <div style={{ flex: 1 }} />
        <div className="qr-hint">
          <div className="qr-mark">
            <span />
          </div>
          <div>At the event? Point your phone camera at the QR code — it opens straight to the event.</div>
        </div>
        <p className="fine" style={{ textAlign: "center" }}>
          Hosting? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </GuestFrame>
  );
}
