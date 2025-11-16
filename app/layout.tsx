import React from 'react';
import Header from '@/components/Header';

export const metadata = {
  title: 'Cinema Swarm Log',
  description: 'Swarm の映画館チェックインを自動記録する個人用ログ',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial', margin: 0, padding: 0 }}>
        <Header />
        <main style={{ padding: '1rem', maxWidth: 960, margin: '0 auto' }}>{children}</main>
      </body>
    </html>
  );
}
