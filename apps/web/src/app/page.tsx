import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-brand-900 text-white">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-brand-500/40 blur-3xl" />
        <div className="absolute top-1/4 -right-40 h-[28rem] w-[28rem] rounded-full bg-accent-500/30 blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 h-96 w-96 rounded-full bg-accent-400/20 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-wider text-accent-200 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-400" />
          Secure healthcare platform
        </div>
        <h1 className="mt-8 text-5xl font-semibold leading-tight tracking-tight sm:text-6xl">
          Your hospital, <span className="text-accent-400">in your pocket.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-brand-100/80">
          Manage records, prescriptions, lab results, imaging, and family access — all in one secure portal.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/login"
            className="group inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-accent-500 to-accent-400 px-6 py-3 font-medium text-white shadow-lg shadow-accent-500/30 transition hover:shadow-xl hover:shadow-accent-500/40 focus:outline-none focus:ring-2 focus:ring-accent-300 focus:ring-offset-2 focus:ring-offset-brand-900"
          >
            Sign in
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 transition-transform group-hover:translate-x-0.5">
              <path
                fillRule="evenodd"
                d="M10.293 4.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L13.586 11H4a1 1 0 110-2h9.586l-3.293-3.293a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/5 px-6 py-3 font-medium text-white backdrop-blur transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30"
          >
            Create account
          </Link>
        </div>

        <div className="mt-16 flex flex-wrap justify-center gap-x-8 gap-y-3 text-xs text-brand-100/70">
          {['HIPAA-aligned', 'End-to-end encrypted', 'Built for care teams'].map((t) => (
            <span key={t} className="inline-flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-accent-400" />
              {t}
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}
