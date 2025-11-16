import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') ?? 50);
  const page = Number(url.searchParams.get('page') ?? 1);
  const from = (page - 1) * limit;

  const { data, error } = await supabaseServer
    .from('checkins')
    .select('*')
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

  if (error) return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });

  return NextResponse.json({ data });
}
