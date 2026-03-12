import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="max-w-2xl text-center">
        <div className="mb-2">
          <p className="eyebrow mb-4">Growth Console</p>
          <h1 className="hero-title text-5xl">Kalit Marketing</h1>
        </div>
        <p className="mt-4 text-[10px] uppercase tracking-[0.28em] text-slate-500">
          Autonomous Growth Operating System
        </p>

        <p className="mt-8 text-sm leading-relaxed text-slate-400">
          Each client gets a dedicated growth runtime that researches, creates,
          launches, reviews, and improves marketing actions continuously.
        </p>

        <div className="mt-10 flex justify-center gap-4">
          <Link href="/dashboard" className="btn-primary px-6 py-3">
            Open Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
