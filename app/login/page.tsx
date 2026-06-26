'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useMemo, useState } from 'react';
import { formInputClass, PageContainer, SurfaceCard } from '@/components/ui/PageContainer';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  const next = searchParams.get('next') || '/dashboard';
  const callbackError = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'password' | 'magic'>('password');
  const [message, setMessage] = useState<string | null>(() => {
    if (callbackError === 'auth_callback_failed') {
      return 'Sign-in failed. If you used GitHub, confirm OAuth is enabled in Supabase and the callback URL is registered. See docs/GITHUB_OAUTH_SETUP.md.';
    }
    if (callbackError) {
      return 'Sign-in link expired or invalid. Please try again.';
    }
    return null;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!supabase) {
    return (
      <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
        Supabase is not configured. Add your project URL and anon key to <code className="text-amber-200">.env.local</code>.
      </p>
    );
  }

  async function handlePasswordSignIn(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setIsSubmitting(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  async function handleMagicLink(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setIsSubmitting(true);
    setMessage(null);

    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    setIsSubmitting(false);
    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage('Check your email for a sign-in link.');
  }

  const modeButtonClass = (active: boolean) =>
    `flex-1 min-h-10 rounded-lg text-sm font-medium transition-colors ${
      active
        ? 'bg-teal-500/10 text-teal-300 border border-teal-500/25'
        : 'text-zinc-400 hover:text-white'
    }`;

  return (
    <div className="space-y-6">
      <header className="space-y-2 text-center">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">Sign in</h1>
        <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
          Access audits, lead research, and linked GitHub repos.
        </p>
      </header>

      <div className="flex rounded-xl border border-white/[0.06] p-1 bg-white/[0.02]">
        <button type="button" onClick={() => setMode('password')} className={modeButtonClass(mode === 'password')}>
          Password
        </button>
        <button type="button" onClick={() => setMode('magic')} className={modeButtonClass(mode === 'magic')}>
          Magic link
        </button>
      </div>

      <form
        onSubmit={mode === 'password' ? handlePasswordSignIn : handleMagicLink}
        className="space-y-4"
      >
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-zinc-300">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={formInputClass}
            placeholder="you@company.com"
          />
        </label>

        {mode === 'password' && (
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-zinc-300">Password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={formInputClass}
              placeholder="••••••••"
            />
          </label>
        )}

        {message && (
          <p
            className={`text-sm rounded-xl p-3 border ${
              message.includes('Check your email')
                ? 'text-teal-300 bg-teal-500/10 border-teal-500/25'
                : 'text-red-300 bg-red-500/10 border-red-500/25'
            }`}
          >
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full min-h-11 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white font-medium transition-colors"
        >
          {isSubmitting ? 'Signing in…' : mode === 'password' ? 'Sign in' : 'Send magic link'}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/[0.06]" />
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-wide">
          <span className="bg-zinc-950 px-2 text-zinc-500">Or</span>
        </div>
      </div>

      <button
        type="button"
        disabled
        aria-disabled="true"
        title="GitHub sign-in is coming soon"
        className="w-full min-h-11 rounded-xl border border-white/[0.06] bg-white/[0.01] text-zinc-500 font-medium cursor-not-allowed"
      >
        Continue with GitHub
        <span className="ml-2 text-xs text-zinc-600">(coming soon)</span>
      </button>

      <p className="text-center text-sm text-zinc-400">
        No account yet?{' '}
        <Link href="/signup" className="text-teal-400 hover:text-teal-300 font-medium">
          Create one
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex-1 flex items-center justify-center py-12">
      <PageContainer narrow>
        <SurfaceCard className="p-6 sm:p-8">
          <Suspense fallback={<p className="text-zinc-400 text-center">Loading…</p>}>
            <LoginForm />
          </Suspense>
        </SurfaceCard>
      </PageContainer>
    </main>
  );
}
