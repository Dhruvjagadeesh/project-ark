"use client";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Login() {
  const router = useRouter();
  const [err, setErr] = useState("");
  async function submit(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const r = await signIn("credentials", { email: f.get("email"), password: f.get("password"), redirect: false });
    if (r?.ok) router.push("/dashboard"); else setErr("Email or password is incorrect.");
  }
  return (
    <div className="login">
      <form className="panel" onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <h1>Project Ark</h1>
        <p className="sub" style={{ margin: 0 }}>Sign in to manage species, sightings and rescues.</p>
        <label>Email<input name="email" type="email" required defaultValue="admin@ark.org" /></label>
        <label>Password<input name="password" type="password" required /></label>
        {err && <div className="msg err">{err}</div>}
        <button>Sign in</button>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>Demo accounts: admin@ark.org, ravi@forest.gov.in, meera@research.org, anil@vet.org — password ark@123</p>
      </form>
    </div>
  );
}
