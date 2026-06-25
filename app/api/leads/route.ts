import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const { searchParams } = request.nextUrl;
  const rank = searchParams.get('rank');
  const status = searchParams.get('status');
  const category = searchParams.get('category');

  let query = supabase
    .from('leads')
    .select('*')
    .order('lead_score', { ascending: false })
    .order('created_at', { ascending: false });

  if (rank === '3' || rank === '4') {
    query = query.eq('rank_position', Number(rank));
  }

  if (status) {
    query = query.eq('status', status);
  }

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ leads: data ?? [] });
}
