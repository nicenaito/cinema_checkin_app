import React from 'react';
import { supabaseServer } from '@/lib/supabaseServer';
import CheckinList from '@/components/CheckinList';

export default async function Page() {
  let items = [];
  try {
    const { data } = await supabaseServer
      .from('checkins')
      .select('id,swarm_checkin_id,created_at,venue_name,comment,movie_id')
      .order('created_at', { ascending: false })
      .limit(10);

    items = data ?? [];
  } catch (err) {
    console.error('fetch checkins error', err);
  }

  return (
    <div>
      <h1>ダッシュボード</h1>
      <section style={{ marginBottom: '1.5rem' }}>
        <h2>最近のチェックイン</h2>
        <CheckinList items={items} />
      </section>
      <section>
        <a href="/checkins">チェックイン一覧を表示</a>
      </section>
    </div>
  );
}
