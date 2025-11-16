import React from 'react';

type Checkin = {
  id?: string;
  swarm_checkin_id?: string;
  created_at?: string;
  venue_name?: string | null;
  comment?: string | null;
  movie_id?: string | null;
};

export default function CheckinList({ items }: { items: Checkin[] }) {
  if (!items || items.length === 0) {
    return <div>チェックインがありません。</div>;
  }

  return (
    <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
      {items.map((c) => (
        <li key={c.id ?? c.swarm_checkin_id} style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{c.movie_id ? '🎬 ' : '📍 '}{c.venue_name ?? '（不明な劇場）'}</div>
          <div style={{ fontSize: 13, color: '#333' }}>{c.comment ?? ''}</div>
          <div style={{ fontSize: 12, color: '#666' }}>{c.created_at ?? ''}</div>
        </li>
      ))}
    </ul>
  );
}
