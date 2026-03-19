"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Megaphone, Loader2, AlertCircle } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
        setLoading(false);
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="relative z-10 w-full max-w-[400px] px-6">
      {/* Logo / Branding */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center border border-white/10 bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <div className="absolute inset-1 bg-gradient-to-br from-[#c8ff00]/20 via-transparent to-cyan-400/10" />
          <Megaphone className="relative h-7 w-7 text-[#c8ff00]" />
        </div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-[#c8ff00]">
          Growth Console
        </p>
        <h1 className="text-2xl font-bold tracking-[-0.04em] text-white">
          Kalit Marketing
        </h1>
        <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-slate-500">
          Autonomous Growth Operating System
        </p>
      </div>

      {/* Login form */}
      <form onSubmit={handleSubmit}>
        <div className="border border-white/10 bg-[rgba(6,10,20,0.92)] p-6 backdrop-blur-xl">
          <h2 className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Sign In
          </h2>

          {error && (
            <div className="mb-4 flex items-center gap-2 border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@company.com"
                className="w-full border border-white/10 bg-white/[0.03] px-3 py-2.5 font-mono text-sm text-white placeholder-slate-600 outline-none transition-colors focus:border-[#c8ff00]/40 focus:bg-white/[0.05]"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Enter your password"
                className="w-full border border-white/10 bg-white/[0.03] px-3 py-2.5 font-mono text-sm text-white placeholder-slate-600 outline-none transition-colors focus:border-[#c8ff00]/40 focus:bg-white/[0.05]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-2 bg-gradient-to-r from-[#c8ff00] via-lime-300 to-cyan-300 py-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-950 transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Authenticating...
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </div>
      </form>

    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050816]">
      {/* Background grid */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
