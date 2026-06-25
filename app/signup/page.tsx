'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';
import { formInputClass, PageContainer, SurfaceCard } from '@/components/ui/PageContainer';
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
      <main className="flex-1 flex items-center justify-center py-12">
        <PageContainer narrow>
          <SurfaceCard className="p-6 sm:p-8">
            <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
              Supabase is not configured. Add your project URL and anon key to{' '}
              <code className="text-amber-200">.env.local</code>.
            </p>
          </SurfaceCard>
        </PageContainer>
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
    <main className="flex-1 flex items-center justify-center py-12">
      <PageContainer narrow>
        <SurfaceCard className="p-6 sm:p-8 space-y-6">
          <header className="space-y-2 text-center">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">Create account</h1>
            <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
              Run site audits, track leads, and link GitHub repos for fix PRs.
            </p>
          </header>

          <form onSubmit={handleSignUp} className="space-y-4">
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

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-zinc-300">Password</span>
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={formInputClass}
                placeholder="At least 6 characters"
              />
            </label>

            {message && (
              <p
                className={`text-sm rounded-xl p-3 border ${
                  message.includes('created')
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
              {isSubmitting ? 'Creating account…' : 'Sign up'}
            </button>
          </form>

          <p className="text-center text-sm text-zinc-400">
            Already have an account?{' '}
            <Link href="/login" className="text-teal-400 hover:text-teal-300 font-medium">
              Sign in
            </Link>
          </p>
        </SurfaceCard>
      </PageContainer>
    </main>
  );
}
