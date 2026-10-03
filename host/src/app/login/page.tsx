"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GuestFrame } from "@/components/chrome";
import { api, ApiError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("host@eventdrop.app");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  return (
    <GuestFrame>
      <div className="stack">
        <p className="eyebrow">Host</p>
        <h1>Sign in</h1>
        <p className="lede">Create an event, share a code, and watch the gallery fill up.</p>
      </div>
      <form
        className="stack card"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          try {
            await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
            router.push("/host");
          } catch (err) {
            setError(err instanceof ApiError ? err.message : "Could not sign in");
          }
        }}
      >
        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        {error ? <p className="bad">{error}</p> : null}
        <button className="btn" type="submit">
          Sign in
        </button>
        <p className="fine">Demo host: host@eventdrop.app / demo-host-1234</p>
      </form>
    </GuestFrame>
  );
}
