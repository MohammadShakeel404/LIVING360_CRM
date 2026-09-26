"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError(res.error === "LOCKED" ? "Too many failed attempts. Try again in 10 minutes." : "That email and password combination doesn't match our records.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-appbg px-4 font-sans">
      <div className="w-full max-w-[380px] rounded-2xl border border-line bg-white p-8">
        <div className="mb-7 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-gold text-[16px] font-extrabold text-dark">L</div>
          <span className="text-lg font-bold text-ink">Living 360</span>
        </div>
        <h1 className="mb-1 text-xl font-bold text-ink">Sign in</h1>
        <p className="mb-6 text-[13.5px] text-ink-soft">Use your Living 360 employee account.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-ink-soft">Email</span>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@living360.in"
              className="rounded-[10px] border-[1.5px] border-line bg-appbg px-3 py-2.5 text-[14.5px] outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-ink-soft">Password</span>
            <input
              type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="rounded-[10px] border-[1.5px] border-line bg-appbg px-3 py-2.5 text-[14.5px] outline-none focus:border-primary"
            />
          </label>

          {error && <div className="rounded-lg bg-danger-bg px-3 py-2 text-[12.5px] font-medium text-danger">{error}</div>}

          <button
            type="submit" disabled={loading}
            className="mt-1 flex items-center justify-center gap-2 rounded-xl2 bg-primary px-4 py-3 text-[14.5px] font-semibold text-white disabled:opacity-60"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
