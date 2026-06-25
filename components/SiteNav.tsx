'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { PageContainer } from '@/components/ui/PageContainer';

const publicLinks = [
  { href: '/', label: 'Home' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/leads', label: 'Leads' },
];

const authLinks = [
  { href: '/research', label: 'Research' },
  { href: '/settings/repos', label: 'Repos' },
];

export function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = user ? [...publicLinks, ...authLinks] : publicLinks;

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
    router.refresh();
  };

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  const linkClass = (href: string) =>
    `inline-flex items-center min-h-10 px-3 rounded-lg text-sm font-medium transition-colors ${
      isActive(href)
        ? 'text-white bg-white/[0.08]'
        : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
    }`;

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-background/80 backdrop-blur-md">
      <PageContainer className="flex items-center justify-between gap-4 py-3">
        <Link href="/" className="text-base font-semibold tracking-tight text-white hover:text-teal-400 transition-colors">
          SynapseCRO
        </Link>

        <ul className="hidden md:flex items-center gap-1">
          {links.map(({ href, label }) => (
            <li key={href}>
              <Link href={href} aria-current={isActive(href) ? 'page' : undefined} className={linkClass(href)}>
                {label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="md:hidden inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/[0.04]"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-menu"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMobileOpen((open) => !open)}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          {isLoading ? (
            <span className="text-xs text-zinc-600 px-2">…</span>
          ) : user ? (
            <div className="flex items-center gap-2">
              <span className="hidden lg:inline text-xs text-zinc-500 max-w-[160px] truncate" title={user.email ?? undefined}>
                {user.email}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className="min-h-10 px-3 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="min-h-10 inline-flex items-center px-4 rounded-lg text-sm font-medium bg-teal-600 hover:bg-teal-500 text-white transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </PageContainer>

      {mobileOpen && (
        <div id="mobile-nav-menu" className="md:hidden border-t border-white/[0.06] bg-background px-4 py-3">
          <ul className="space-y-1">
            {links.map(({ href, label }) => (
              <li key={href}>
                <Link href={href} onClick={() => setMobileOpen(false)} className={`flex ${linkClass(href)}`}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
