'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';

export default function SignupPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!supabase) {
    return (
      <main className="flex-1 bg-slate-950 text-slate-100 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/40 p-6 sm:p-8">
          <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            Supabase is not configured. Add your project URL and anon key to{' '}
            <code className="text-amber-200">.env.local</code>.
          </p>
        </div>
      </main>
    );
  }

  async function handleSignUp(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setIsSubmitting(true);
    setMessage(null);

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    if (data.session) {
      router.push('/dashboard');
      router.refresh();
      return;
    }

    setMessage('Account created. Check your email to confirm, then sign in.');
    setIsSubmitting(false);
  }

  return (
    <main className="flex-1 bg-slate-950 text-slate-100 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/40 p-6 sm:p-8 space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Create your account</h1>
          <p className="text-slate-400 text-sm sm:text-base">
            Get access to research tools, repo linking, and PR automation.
          </p>
        </header>

        <form onSubmit={handleSignUp} className="space-y-4">
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

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-300">Password</span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full min-h-11 rounded-lg border border-slate-700 bg-slate-900 px-3 text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none"
              placeholder="At least 6 characters"
            />
          </label>

          {message && (
            <p
              className={`text-sm rounded-lg p-3 border ${
                message.includes('created')
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
            {isSubmitting ? 'Creating account…' : 'Sign up'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link href="/login" className="text-emerald-400 hover:text-emerald-300 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
