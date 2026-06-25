'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useMemo, useState } from 'react';
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
      <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
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

  async function handleGitHubSignIn() {
    if (!supabase) return;
    setIsSubmitting(true);
    setMessage(null);

    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo },
    });

    if (error) {
      setMessage(
        error.message.includes('OAuth')
          ? `${error.message} — check GitHub OAuth setup in Supabase (see docs/GITHUB_OAUTH_SETUP.md).`
          : error.message
      );
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Welcome back</h1>
        <p className="text-slate-400 text-sm sm:text-base">
          Sign in to run research audits, link repos, and create GitHub PRs.
        </p>
      </header>

      <div className="flex rounded-lg border border-slate-800 p-1 bg-slate-900/60">
        <button
          type="button"
          onClick={() => setMode('password')}
          className={`flex-1 min-h-10 rounded-md text-sm font-medium transition-colors ${
            mode === 'password'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => setMode('magic')}
          className={`flex-1 min-h-10 rounded-md text-sm font-medium transition-colors ${
            mode === 'magic'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Magic link
        </button>
      </div>

      <form
        onSubmit={mode === 'password' ? handlePasswordSignIn : handleMagicLink}
        className="space-y-4"
      >
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-300">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full min-h-11 rounded-lg border border-slate-700 bg-slate-900 px-3 text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none"
            placeholder="you@company.com"
          />
        </label>

        {mode === 'password' && (
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-300">Password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full min-h-11 rounded-lg border border-slate-700 bg-slate-900 px-3 text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none"
              placeholder="••••••••"
            />
          </label>
        )}

        {message && (
          <p
            className={`text-sm rounded-lg p-3 border ${
              message.includes('Check your email')
                ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
                : 'text-red-300 bg-red-500/10 border-red-500/30'
            }`}
          >
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full min-h-11 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-medium transition-colors"
        >
          {isSubmitting ? 'Signing in…' : mode === 'password' ? 'Sign in' : 'Send magic link'}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-800" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-slate-950 px-2 text-slate-500">Or</span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleGitHubSignIn}
        disabled={isSubmitting}
        className="w-full min-h-11 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-medium transition-colors"
      >
        Continue with GitHub
      </button>

      <p className="text-center text-sm text-slate-400">
        No account yet?{' '}
        <Link href="/signup" className="text-emerald-400 hover:text-emerald-300 font-medium">
          Create one
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex-1 bg-slate-950 text-slate-100 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/40 p-6 sm:p-8">
        <Suspense fallback={<p className="text-slate-400 text-center">Loading…</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
