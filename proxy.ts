import { NextResponse, type NextRequest } from 'next/server';
import { isCronAuthorized } from '@/lib/auth/cron-auth';
import { updateSession } from '@/lib/supabase/middleware';

function isProtectedPage(pathname: string): boolean {
  if (pathname.startsWith('/settings')) return true;
  if (pathname === '/research') return true;
  if (/^\/research\/[^/]+$/.test(pathname)) return false;
  if (pathname.startsWith('/research')) return true;
  return false;
}

function isAuthPage(pathname: string): boolean {
  return pathname === '/login' || pathname === '/signup';
}

function isProtectedApiRoute(pathname: string, method: string, request: NextRequest): boolean {
  if (pathname.startsWith('/api/repos')) {
    return true;
  }

  if (pathname === '/api/research/analyze' && method === 'POST') {
    return true;
  }

  if (pathname === '/api/research' && method === 'GET') {
    return true;
  }

  if (/^\/api\/research\/[^/]+$/.test(pathname) && method === 'GET') {
    return false;
  }

  if (pathname === '/api/leads/export' && method === 'GET') {
    return true;
  }

  if (/^\/api\/leads\/[^/]+\/social-summary$/.test(pathname) && method === 'GET') {
    return true;
  }

  if (/^\/api\/leads\/[^/]+$/.test(pathname) && method === 'PATCH') {
    return true;
  }

  if (pathname === '/api/leads/discover' && method === 'POST') {
    return true;
  }

  if (pathname === '/api/leads' && method === 'GET') {
    return true;
  }

  if (pathname === '/api/optimize' && (method === 'POST' || method === 'GET')) {
    return !isCronAuthorized(request);
  }

  if (pathname === '/api/cron/re-audit-leads' && (method === 'POST' || method === 'GET')) {
    return !isCronAuthorized(request);
  }

  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  const { response, user } = await updateSession(request);

  if (isAuthPage(pathname) && user) {
    const next = request.nextUrl.searchParams.get('next') || '/dashboard';
    return NextResponse.redirect(new URL(next, request.url));
  }

  if (isProtectedPage(pathname) && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isProtectedApiRoute(pathname, method, request) && !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
