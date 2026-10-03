"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GuestFrame } from "@/components/chrome";

export default function EnterCodePage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  return (
    <GuestFrame>
      <div className="stack" style={{ marginTop: 36 }}>
        <p className="eyebrow">Join an event</p>
        <h1>One event. Everyone&apos;s photos. One place.</h1>
        <p className="lede">Enter the code from the invite, or scan the QR at the venue. No account.</p>
      </div>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          const next = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
          if (next.length >= 4) router.push(`/e/${next}`);
        }}
      >
        <label>
          Event code
          <input
            className="code"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={8}
            placeholder="ABC123"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
          />
        </label>
        <button className="btn block" type="submit">
          Continue
        </button>
      </form>
      <p className="fine">
        Hosting? <a href="/login">Sign in</a>
      </p>
    </GuestFrame>
  );
}
