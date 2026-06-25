import { NextResponse } from 'next/server';

export interface ApiErrorBody {
  error: string;
  code?: string;
}

export function apiError(message: string, status: number, code?: string): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: message, ...(code ? { code } : {}) }, { status });
}

export function apiNotConfigured(service: string): NextResponse<ApiErrorBody> {
  return apiError(`${service} not configured`, 503, 'NOT_CONFIGURED');
}
