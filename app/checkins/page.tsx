import React from 'react';
import { supabaseServer } from '@/lib/supabaseServer';
import CheckinList from '@/components/CheckinList';

export default async function CheckinsPage() {
  let items = [];
  try {
    const { data } = await supabaseServer
      .from('checkins')
      .select('id,swarm_checkin_id,created_at,venue_name,comment,movie_id')
      .order('created_at', { ascending: false })
      .limit(100);

    items = data ?? [];
  } catch (err) {
    console.error('fetch checkins error', err);
  }

  return (
    <div>
      <h1>チェックイン一覧</h1>
      <CheckinList items={items} />
    </div>
  );
}
