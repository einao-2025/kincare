'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  mfaCode: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      const data = await api<{ accessToken: string; refreshToken: string; user: any }>(
        '/auth/login', { method: 'POST', json: values, anonymous: true },
      );
      setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
      router.push('/dashboard');
    } catch (e: any) {
      setServerError(e.message);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-brand-900 text-white">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-brand-500/40 blur-3xl" />
        <div className="absolute top-1/3 -right-40 h-[28rem] w-[28rem] rounded-full bg-accent-500/30 blur-3xl" />
        <div className="absolute -bottom-40 left-1/4 h-96 w-96 rounded-full bg-accent-400/20 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-6xl place-items-center px-6 py-12 lg:grid-cols-2 lg:gap-16">
        {/* Brand panel */}
        <section className="hidden lg:block">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-wider text-accent-200 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-400" />
            Secure clinical access
          </div>
          <h2 className="mt-6 text-5xl font-semibold leading-tight tracking-tight">
            Care that <span className="text-accent-400">connects</span>
            <br /> families and clinicians.
          </h2>
          <p className="mt-5 max-w-md text-base text-brand-100/80">
            Sign in to coordinate care plans, review records, and stay in sync with your care team — all in one place.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-brand-100/90">
            {[
              'End-to-end encrypted records',
              'HIPAA-aligned audit & access controls',
              'Built for multi-disciplinary care teams',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-5 w-5 place-items-center rounded-full bg-accent-500/20 text-accent-300">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                    <path
                      fillRule="evenodd"
                      d="M16.704 5.296a1 1 0 010 1.408l-7.5 7.5a1 1 0 01-1.408 0l-3.5-3.5a1 1 0 011.408-1.408L8.5 12.092l6.796-6.796a1 1 0 011.408 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* Auth card */}
        <section className="w-full max-w-md justify-self-center lg:justify-self-end">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="w-full space-y-5 rounded-2xl border border-white/10 bg-white/95 p-8 text-clinical-text shadow-2xl shadow-brand-900/40 backdrop-blur-xl ring-1 ring-black/5"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-md">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M12 21s-7-4.534-7-10a5 5 0 019-2.917A5 5 0 0119 11c0 5.466-7 10-7 10z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
                <p className="text-sm text-clinical-muted">Sign in to your account</p>
              </div>
            </div>

            {serverError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 flex-shrink-0">
                  <path
                    fillRule="evenodd"
                    d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{serverError}</span>
              </div>
            )}

            <Field label="Email" error={errors.email?.message}>
              <input
                type="email"
                {...register('email')}
                className={inputCls}
                autoComplete="email"
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Password" error={errors.password?.message}>
              <input
                type="password"
                {...register('password')}
                className={inputCls}
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </Field>
            {/* <Field label="MFA code" hint="If enabled" error={errors.mfaCode?.message}>
              <input
                inputMode="numeric"
                {...register('mfaCode')}
                className={inputCls}
                autoComplete="one-time-code"
                placeholder="123 456"
              />
            </Field> */}

            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative w-full overflow-hidden rounded-lg bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-2.5 font-medium text-white shadow-lg shadow-brand-600/20 transition hover:shadow-xl hover:shadow-accent-500/20 focus:outline-none focus:ring-2 focus:ring-accent-400 focus:ring-offset-2 disabled:opacity-60"
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-accent-500 to-accent-400 transition-transform duration-300 group-hover:translate-x-0" />
              <span className="relative flex items-center justify-center gap-2">
                {isSubmitting ? 'Signing in…' : 'Sign in'}
                {!isSubmitting && (
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 transition-transform group-hover:translate-x-0.5">
                    <path
                      fillRule="evenodd"
                      d="M10.293 4.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L13.586 11H4a1 1 0 110-2h9.586l-3.293-3.293a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </span>
            </button>

            <p className="text-center text-xs text-clinical-muted">
              Protected by enterprise-grade security.{' '}
              <span className="font-medium text-brand-600">Need help?</span>
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}

const inputCls =
  'w-full rounded-lg border border-clinical-border bg-white px-3.5 py-2.5 text-sm text-clinical-text placeholder:text-clinical-muted/60 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-medium text-clinical-text">{label}</span>
        {hint && <span className="text-xs text-clinical-muted">{hint}</span>}
      </div>
      {children}
      {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
    </label>
  );
}
