import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { extractMovieTitle } from '@/lib/extractMovieTitle';

const SWARM_API_TOKEN = process.env.SWARM_API_TOKEN;
const SWARM_API_BASE = 'https://api.foursquare.com/v2';

if (!SWARM_API_TOKEN) {
  throw new Error('SWARM_API_TOKEN is not set');
}

export async function GET(req: Request) {
  const adminHeader = req.headers.get('x-admin-token');
  const expected = process.env.ADMIN_TOKEN;
  if (expected && adminHeader !== expected) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // 1) 最終同期時刻を取得
  const { data: setting, error: settingErr } = await supabaseServer
    .from('settings')
    .select('value')
    .eq('key', 'last_synced_at')
    .single();

  if (settingErr && settingErr.code !== 'PGRST116') {
    console.error('settings select error', settingErr);
  }

  let afterTimestamp: number | undefined;
  if (setting && setting.value) {
    afterTimestamp = Math.floor(new Date(setting.value as string).getTime() / 1000);
  }

  // 2) Swarm API 呼び出し
  const v = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const url = `${SWARM_API_BASE}/users/self/checkins?oauth_token=${encodeURIComponent(SWARM_API_TOKEN)}&v=${v}&limit=250`;
  const res = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });

  if (!res.ok) {
    const text = await res.text();
    return new NextResponse(`Swarm API error: ${res.status} ${text}`, { status: 502 });
  }

  const json = await res.json();
  const items = json.response?.checkins?.items ?? [];

  let synced = 0;

  for (const item of items) {
    try {
      const swarmCheckinId = item.id?.toString();
      if (!swarmCheckinId) continue;

      // 重複チェック
      const { data: existing } = await supabaseServer
        .from('checkins')
        .select('id')
        .eq('swarm_checkin_id', swarmCheckinId)
        .limit(1)
        .maybeSingle();

      if (existing) continue;

      // venueカテゴリ判定 (簡易)
      const venueCategories = item.venue?.categories ?? [];
      const isCinema = venueCategories.some((c: any) => {
        const name = (c.name || '').toString().toLowerCase();
        return name.includes('cinema') || name.includes('movie') || name.includes('映画館') || name.includes('映画');
      });

      if (!isCinema) continue;

      // コメントからタイトル抽出
      const comment = item.shout || item.comment || item.text || null;
      const title = extractMovieTitle(comment);

      // movie を探す / なければ作る
      let movieId: string | null = null;
      if (title) {
        const normalized = title.trim().toLowerCase();
        const { data: movieRow } = await supabaseServer
          .from('movies')
          .select('movie_id')
          .eq('normalized_title', normalized)
          .limit(1)
          .maybeSingle();

        if (movieRow && (movieRow as any).movie_id) {
          movieId = (movieRow as any).movie_id;
        } else {
          const { data: newMovie } = await supabaseServer
            .from('movies')
            .insert([{ title, normalized_title: normalized }])
            .select('movie_id')
            .single();
          movieId = (newMovie as any).movie_id;
        }
      }

      await supabaseServer.from('checkins').insert([{
        swarm_checkin_id: swarmCheckinId,
        user_id: item.user?.id?.toString() ?? null,
        created_at: item.createdAt ? new Date(item.createdAt * 1000).toISOString() : new Date().toISOString(),
        venue_name: item.venue?.name ?? null,
        venue_id: item.venue?.id ?? null,
        venue_categories: item.venue?.categories ?? null,
        comment: comment ?? null,
        movie_id: movieId,
        raw_payload: item,
      }]);

      synced += 1;
    } catch (err) {
      console.error('Error processing item', err);
    }
  }

  // 4) last_synced_at 更新
  await supabaseServer
    .from('settings')
    .upsert({ key: 'last_synced_at', value: new Date().toISOString() }, { onConflict: 'key' });

  return NextResponse.json({ ok: true, synced });
}
