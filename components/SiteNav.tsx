'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

const links = [
  { href: '/', label: 'Home' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/leads', label: 'Leads' },
  { href: '/research', label: 'Research' },
  { href: '/settings/repos', label: 'Repos' },
  { href: '/seo-guide', label: 'SEO Guide' },
];

export function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
    router.refresh();
  };

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-sm sticky top-0 z-50">
      <nav
        className="max-w-5xl mx-auto flex items-center justify-between gap-4 px-4 sm:px-6 py-4"
        aria-label="Main navigation"
      >
        <Link
          href="/"
          className="text-base sm:text-lg font-semibold text-white hover:text-emerald-400 transition-colors rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
        >
          SynapseCRO
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <ul className="hidden sm:flex items-center gap-1 sm:gap-2">
            {links.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={isActive(href) ? 'page' : undefined}
                  className={`inline-flex items-center min-h-11 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                    isActive(href)
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          <button
            type="button"
            className="sm:hidden inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800/60"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-menu"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>

          <div className="flex items-center gap-2 border-l border-slate-800 pl-2 sm:pl-3">
            {isLoading ? (
              <span className="text-xs text-slate-500 px-2">…</span>
            ) : user ? (
              <>
                <span
                  className="hidden md:inline text-xs text-slate-400 max-w-[140px] truncate"
                  title={user.email ?? undefined}
                >
                  {user.email}
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center min-h-9 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center min-h-9 px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </nav>

      {mobileOpen && (
        <div id="mobile-nav-menu" className="sm:hidden border-t border-slate-800 bg-slate-950/95 px-4 py-3">
          <ul className="space-y-1">
            {links.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={isActive(href) ? 'page' : undefined}
                  className={`flex min-h-11 items-center px-3 rounded-lg text-sm font-medium ${
                    isActive(href)
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
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
