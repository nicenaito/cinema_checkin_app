'use client';

import React, { useState } from 'react';

export default function Header() {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSync() {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch('/api/sync');
      const json = await res.json();
      if (res.ok) {
        setStatus(`同期成功: ${json.synced ?? json.syncedCount ?? 0} 件`);
      } else {
        setStatus(`同期失敗: ${json?.error ?? JSON.stringify(json)}`);
      }
    } catch (err: any) {
      setStatus(`エラー: ${err?.message ?? String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <header style={{ background: '#0f172a', color: '#fff', padding: '0.5rem 1rem' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <strong>Cinema Swarm Log</strong>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button onClick={handleSync} disabled={loading} style={{ padding: '0.4rem 0.6rem' }}>
            {loading ? '同期中...' : '手動同期'}
          </button>
          {status ? <div style={{ fontSize: 12 }}>{status}</div> : null}
        </div>
      </div>
    </header>
  );
}
