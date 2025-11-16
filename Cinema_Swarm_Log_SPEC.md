# Cinema Swarm Log — 開発仕様書


最終更新: 2025-11-08

このドキュメントは、Next.js（App Router）とSupabaseを利用してSwarmの映画館チェックインを自動取得・保存する個人用Webアプリ（ログ専用）の実装者向け詳細仕様書です。TypeScriptのコード例、SQLスキーマ、デプロイ手順まで含め、開発者がそのまま実装に着手できるレベルで記載します。

---

## 目次

1. アプリ概要
2. 技術スタックと構成図
3. 主要機能一覧
4. データベース設計
5. API設計
6. フロントエンド構成（Next.js）
7. セキュリティ設計
8. デプロイ手順
9. 将来的な拡張アイデア
10. 付録：コード例（TypeScript）, SQL, テスト例

---

## 1. アプリ概要

- アプリ名（例）
  - Cinema Swarm Log

- 目的と特徴
  - Swarm（Foursquare）で行ったチェックインのうち「映画館」カテゴリだけを抽出し、チェックインコメントから作品名をヒューリスティックに抽出して、Supabase（Postgres）に保存・閲覧する個人用ログアプリ。
  - 個人利用（ログイン不要）を前提。サーバサイドがSwarm APIキーとSupabaseのService Roleキーを保持し、クライアントへはキーを一切露出しない。
  - 定期同期（Cron）または手動同期でチェックインを取り込み、誤抽出は手動で修正できるUIを提供。

- 想定する利用シーン
  - 映画を観たあとにSwarmでチェックインすると、翌朝に自動的に自分の映画履歴が更新されている。
  - 年別や劇場別に観た回数を確認したい個人用途。
  - 将来的にTMDBと連携してポスターやメタデータを表示する基盤として利用。

---

## 2. 技術スタックと構成図

- フロントエンド
  - Next.js（App Router） + TypeScript
  - React Server Components を活用したサーバ取得（SSR）と、必要な箇所のみクライアントコンポーネント化

- バックエンド / DB
  - Supabase (PostgreSQL)
  - SupabaseのService Roleキーをサーバでのみ利用

- 外部API
  - Swarm / Foursquare API（ユーザチェックイン取得）

- ホスティング / CI
  - Vercel（Next.jsホスティング、環境変数、Cron機能）
  - 代替: GitHub Actions で定期実行（スケジュール）

- 構成図（テキスト）
  - ブラウザ -> Next.js (Vercel)
  - Next.js サーバサイド API (例: `/api/sync`) -> Swarm API
  - Next.js サーバ -> Supabase (Service Role)
  - Supabase -> Postgres ストレージ (tables: `checkins`, `movies`, `settings`)

---

## 3. 主要機能一覧

1. Swarmチェックイン自動取得
   - 定期的に Swarm API を叩いてチェックインを取得。前回同期以降の更新のみを処理。

2. 映画館カテゴリのみ抽出
   - 取得したチェックインの `venue.categories` を見て、映画館に該当するものだけを処理する。

3. コメント内から作品名抽出
   - 日本語や英語の慣例（「」、『』、""、（）など）に基づくヒューリスティックでタイトルを抽出。
   - 抽出できなければチェックインの `raw_payload` を保存し、手動修正を可能にする。

4. Supabaseへの保存・一覧表示
   - `checkins` と `movies` に分けて保存。
   - 映画（`movies`）は正規化タイトル `normalized_title` で検索・マージ。

5. 個人用の簡易UI（ログイン不要）
   - シンプルな閲覧・編集UI。公開範囲は個人用を想定。必要なら Basic Auth などの保護を追加可能。

---

## 4. データベース設計

### ER図（テキスト）

- movies (1) -- (N) checkins
  - 1つの映画は複数のチェックインを持ち得る（同作品を複数回観るケース）

### テーブル一覧

- `movies`
  - movie_id (uuid PK)
  - title (text) -- オリジナル表示用
  - normalized_title (text) -- 検索用、正規化済
  - tmdb_id (integer, nullable)
  - notes (text, nullable)
  - created_at (timestamptz)
  - updated_at (timestamptz)

- `checkins`
  - id (uuid PK)
  - swarm_checkin_id (text unique) -- SwarmのチェックインID
  - user_id (text nullable)
  - created_at (timestamptz) -- チェックイン発生時刻
  - venue_name (text)
  - venue_id (text nullable)
  - venue_categories (jsonb nullable)
  - comment (text nullable)
  - movie_id (uuid nullable リファレンス `movies.movie_id`)
  - raw_payload (jsonb not null)
  - inserted_at (timestamptz)

- `settings` (キー・バリュー保存)
  - key (text PK)
  - value (text)
  - updated_at (timestamptz)

### SQL（Supabaseコンソール用の例）

```sql
-- movies
create table if not exists movies (
  movie_id uuid primary key default gen_random_uuid(),
  title text not null,
  normalized_title text,
  tmdb_id integer,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- checkins
create table if not exists checkins (
  id uuid primary key default gen_random_uuid(),
  swarm_checkin_id text unique not null,
  user_id text,
  created_at timestamptz not null,
  venue_name text,
  venue_id text,
  venue_categories jsonb,
  comment text,
  movie_id uuid references movies(movie_id),
  raw_payload jsonb not null,
  inserted_at timestamptz default now()
);

-- settings
create table if not exists settings (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

-- インデックス
create index if not exists idx_checkins_created_at on checkins (created_at);
create index if not exists idx_checkins_movie_id on checkins (movie_id);
create index if not exists idx_movies_normalized_title on movies (normalized_title);
```

> 注意: `gen_random_uuid()` を使うためには `pgcrypto` が有効である必要があります。なければ `uuid_generate_v4()`（`uuid-ossp`）を使うか、アプリ側で UUID を生成して INSERT してください。

---

## 5. API設計

### Swarm (Foursquare) API（使用例）

- エンドポイント（例）
  - GET https://api.foursquare.com/v2/users/self/checkins?oauth_token={SWARM_API_TOKEN}&v=YYYYMMDD&limit=250

※ Swarm/Foursquare の API 仕様は変わる可能性があるため、実際のトークン種別（`oauth_token` か `Bearer`）は現状のAPIドキュメントに合わせて実装してください。

### 環境変数（必須）

- `SWARM_API_TOKEN` — Swarm のアクセストークン
- `SUPABASE_URL` — Supabase プロジェクト URL
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key（サーバ専用）
- `ADMIN_TOKEN` (任意) — 内部 API 保護用の簡易トークン

### データ取得・変換フロー（同期処理の概要）

1. `settings` の `last_synced_at` を参照して、前回同期以降のチェックインを取得するための基準を決定
2. Swarm API を叩いてチェックインを取得（ページングが必要なら実装）
3. 各チェックインについて処理:
   - 既存の `swarm_checkin_id` がある場合はスキップ（重複除外）
   - `venue.categories` を見て映画館か判定（名称に `cinema` / `movie` / `映画` 等を含むか）
   - コメントから作品名を抽出（`extractMovieTitle`）
   - 抽出したタイトルを `normalized_title` で既存の `movies` と突合
     - 見つかれば `movie_id` を参照して `checkins` を挿入
     - 見つからなければ `movies` に挿入してから `checkins` を挿入
   - `raw_payload` として Swarm の生オブジェクトを保存
4. 同期完了後、`settings.last_synced_at` を更新

### Next.js Route Handlers（推奨エンドポイント）

- `GET /api/sync` — Swarm からのチェックイン同期（サーバサイド限定）
- `GET /api/checkins` — チェックイン一覧取得（ページング）
- `GET /api/movies` — 映画一覧取得
- `POST /api/movies/:id` — 映画の手動編集（タイトル修正など）

> いずれの API も内部で `SUPABASE_SERVICE_ROLE_KEY` を使って Supabase を操作する。クライアントにはこのキーを渡さない。

---

## 6. フロントエンド構成（Next.js）

### 想定ディレクトリ（App Router）

```
app/
  layout.tsx
  page.tsx                # ダッシュボード
  checkins/
    page.tsx              # チェックイン一覧
    [id]/page.tsx         # チェックイン詳細
  movies/
    page.tsx              # 映画一覧
    [id]/page.tsx         # 映画詳細・編集
  api/
    sync/route.ts
    checkins/route.ts
    movies/route.ts
lib/
  supabaseServer.ts
  extractMovieTitle.ts
  normalizeTitle.ts
components/
  CheckinList.tsx
  MovieList.tsx
  Header.tsx
  Footer.tsx
```

### ページの責務

- `app/page.tsx` — ダッシュボード: 最近のチェックイン/最近追加された映画/最終同期時刻/手動同期ボタン
- `app/checkins/page.tsx` — フィルタ（年・劇場）とチェックイン一覧
- `app/movies/page.tsx` — 映画一覧、観た回数の集計表示
- `app/movies/[id]/page.tsx` — 映画の詳細、手動でのタイトル編集やTMDB連携ボタン

### データフェッチ戦略

- サーバコンポーネントで `lib/supabaseServer.ts` を使って SSR 的にデータを取得
- 編集操作や同期ボタンはクライアントで API を叩く（`/api/*`）
- ページングはサーバ側で行い、必要に応じてクライアントで `fetch` を使って非同期にロード

### UI モック（階層表）

- Header
  - サイト名、同期ボタン（管理）、最終同期時刻表示
- Main
  - サイドバー（年フィルタ、検索）
  - コンテンツ領域（チェックイン一覧 / 映画一覧）
- Footer
  - バージョン情報、デプロイ日時

---

## 7. セキュリティ設計

### `.env` とローカル管理

- ローカル開発では `.env.local` を使用し、以下を定義:
  - SWARM_API_TOKEN=...
  - SUPABASE_URL=...
  - SUPABASE_SERVICE_ROLE_KEY=...
  - ADMIN_TOKEN=... (任意)
- `.gitignore` に `.env*` を追加してコミットしない

### Vercel での環境変数設定

- Vercel Dashboard の Environment Variables に上記環境変数を登録
- `SUPABASE_SERVICE_ROLE_KEY` は Production のみなど環境ごとに設定

### クライアント側トークン露出防止

- Swarm API への呼び出しはすべてサーバサイド（`/api/sync`）から行う
- Supabase の Service Role キーはサーバのみで使用
- フロントは公開用の読み取りAPI（必要なら）を用意し、認証が必要な操作は内部 API 経由で行う

### 内部APIの保護オプション

- `ADMIN_TOKEN` を要求する（ヘッダ `x-admin-token`）
- Vercel の IP 制限や Basic Auth（Vercel の Protect by Password 機能）を利用

### Supabase RLS の扱い

- 現状（個人用）: RLS を無効にして Service Role で運用
- 将来的にユーザ管理を行う場合は RLS を有効にしてトークンベースの認証へ移行

---

## 8. デプロイ手順

### Supabase 初期設定

1. Supabase にログインしてプロジェクトを作成
2. SQL エディタで上記のテーブル作成 SQL を実行
3. Settings -> API から `SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` を取得
   - `service_role` は強力なので漏えいさせない

### Next.js プロジェクト準備（ローカル）

1. Node.js（推奨: 18以上）をインストール
2. プロジェクトルートで Next.js App Router 構成を準備
3. 必要な依存を追加:

```bash
# 例 (pnpm)
pnpm init -y
pnpm add next react react-dom
pnpm add @supabase/supabase-js
pnpm add -D typescript @types/react @types/node
```

4. `.env.local` に環境変数を設定

### Vercel デプロイ

1. GitHub にリポジトリを push
2. Vercel でインポートしてプロジェクトを作成
3. Environment Variables に以下を登録:
   - SWARM_API_TOKEN
   - SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY
   - ADMIN_TOKEN (任意)
4. デプロイ実行

### 定期同期の設定

- 選択肢 A: Vercel Cron（利用可能なら）で `GET /api/sync` を定期実行
- 選択肢 B: GitHub Actions で定期的に `curl` を叩く

サンプル GitHub Actions:

```yaml
# .github/workflows/sync.yml
name: Daily Swarm Sync
on:
  schedule:
    - cron: '0 3 * * *' # 毎日 03:00 UTC
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Call sync endpoint
        run: |
          curl -sS -H "x-admin-token: ${{ secrets.ADMIN_TOKEN }}" "https://your-deployment.vercel.app/api/sync"
```

---

## 9. 将来的な拡張アイデア

- TMDB 連携
  - 抽出した作品名から TMDB API を検索して `tmdb_id` を保存し、ポスターや詳細を表示

- 映画レビュー記録
  - 各チェックインにレビューやスコアを付けられる UI を追加

- 統計機能
  - 年別 / 劇場別 / 監督別 / ジャンル別の集計と可視化

- Supabase Auth を利用したマルチユーザー化
  - 認証と RLS を導入し、複数ユーザーでの利用に対応

- PWA 化
  - オフライン閲覧やホーム画面追加をサポート

---

## 10. 付録：コード例（TypeScript）

以下はそのまま実装に貼って使えるサンプルコードです。実際の Swarm API レスポンススキーマに合わせてマッピング箇所（例: `item.createdAt` や `item.shout`）は調整してください。

### `lib/supabaseServer.ts`

```ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase environment variables are not set');
}

export const supabaseServer = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});
```

---

### `lib/extractMovieTitle.ts`

```ts
/**
 * コメントから映画タイトルを抽出するヒューリスティック関数
 */
export function extractMovieTitle(comment: string | null | undefined): string | null {
  if (!comment) return null;
  const text = comment.trim();

  // 1: 「...」 or 『...』
  const japaneseQuotes = [/「([^」]+)」/, /『([^』]+)』/];
  for (const r of japaneseQuotes) {
    const m = text.match(r);
    if (m && m[1]) return m[1].trim();
  }

  // 2: "..." or “...”
  const quotes = [/["“”]{1}([^"“”]+)["“”]{1}/];
  for (const r of quotes) {
    const m = text.match(r);
    if (m && m[1]) return m[1].trim();
  }

  // 3: （...）全角丸括弧
  const paren = /（([^）]+)）/;
  const mParen = text.match(paren);
  if (mParen && mParen[1]) return mParen[1].trim();

  // 4: 英語っぽい文字列を拾う
  const english = text.match(/([A-Za-z0-9:’'’&\-\s]{3,})/);
  if (english && english[1]) {
    const candidate = english[1].trim();
    if (candidate.length >= 3 && candidate.split(/\s+/).length <= 6) {
      return candidate;
    }
  }

  return null;
}
```

---

### `app/api/sync/route.ts`（Route Handler のサンプル）

```ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { extractMovieTitle } from '@/lib/extractMovieTitle';

const SWARM_API_TOKEN = process.env.SWARM_API_TOKEN;
const SWARM_API_BASE = 'https://api.foursquare.com/v2';

if (!SWARM_API_TOKEN) {
  throw new Error('SWARM_API_TOKEN is not set');
}

export async function GET(req: Request) {
  // 簡易Adminトークンチェック（任意）
  const adminHeader = req.headers.get('x-admin-token');
  const expected = process.env.ADMIN_TOKEN;
  if (expected && adminHeader !== expected) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // 1) 最終同期時刻を取得
  const { data: setting } = await supabaseServer
    .from('settings')
    .select('value')
    .eq('key', 'last_synced_at')
    .single();

  let afterTimestamp: number | undefined;
  if (setting && setting.value) {
    afterTimestamp = Math.floor(new Date(setting.value).getTime() / 1000);
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

  // 3) 各チェックインを処理
  for (const item of items) {
    try {
      const swarmCheckinId = item.id?.toString();
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
      let movieId = null;
      if (title) {
        const normalized = title.trim().toLowerCase();
        const { data: movies } = await supabaseServer
          .from('movies')
          .select('movie_id')
          .eq('normalized_title', normalized)
          .limit(1)
          .maybeSingle();

        if (movies) {
          movieId = movies.movie_id;
        } else {
          const { data: newMovie } = await supabaseServer
            .from('movies')
            .insert([{ title, normalized_title: normalized }])
            .select('movie_id')
            .single();
          movieId = newMovie.movie_id;
        }
      }

      // checkins 保存
      await supabaseServer.from('checkins').insert([{
        swarm_checkin_id: swarmCheckinId,
        user_id: item.user?.id?.toString() ?? null,
        created_at: new Date(item.createdAt * 1000).toISOString(),
        venue_name: item.venue?.name ?? null,
        venue_id: item.venue?.id ?? null,
        venue_categories: item.venue?.categories ?? null,
        comment: comment ?? null,
        movie_id: movieId,
        raw_payload: item,
      }]);
    } catch (err) {
      console.error('Error processing item', err);
    }
  }

  // 4) last_synced_at 更新
  await supabaseServer
    .from('settings')
    .upsert({ key: 'last_synced_at', value: new Date().toISOString() }, { onConflict: 'key' });

  return NextResponse.json({ ok: true, syncedCount: items.length });
}
```

> 実運用では Swarm のレスポンスに応じたフィールドマッピング（例: createdAt の存在・形式）とエラーハンドリング、ページング/レートリミット対応、リトライロジックを入れてください。

---

### API：チェックイン一覧 例

```ts
// app/api/checkins/route.ts
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
```

---

## 単体テスト例（抽出関数）

`vitest` を使った例

```ts
// test/extractMovieTitle.test.ts
import { describe, it, expect } from 'vitest';
import { extractMovieTitle } from '../lib/extractMovieTitle';

describe('extractMovieTitle', () => {
  it('extracts from Japanese quotes', () => {
    expect(extractMovieTitle('今日は「君の名は。」を観た')).toBe('君の名は。');
  });

  it('extracts from parentheses', () => {
    expect(extractMovieTitle('（スター・ウォーズ）最高だった')).toBe('スター・ウォーズ');
  });

  it('returns null for unrelated comment', () => {
    expect(extractMovieTitle('友達と飲み会')).toBeNull();
  });
});
```

package.json にスクリプトを追加:

```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@types/node": "latest"
  },
  "scripts": {
    "test": "vitest"
  }
}
```

---

## 品質ゲート / チェックリスト

- [ ] `next build` が通る（環境変数チェックをサーバ側で行う）
- [ ] TypeScript の型チェック（`pnpm tsc --noEmit`）
- [ ] 抽出関数のユニットテストが通る（`pnpm test`）
- [ ] Supabase にテーブルを適用して、`/api/sync` の実行でデータが入ることを確認

---

## エッジケースと運用上の注意点

- Swarm API のレート制限に注意。ページング・遅延・リトライ（指数バックオフ）を実装する。
- コメントに対する抽出失敗や表記揺れに対しては `normalized_title` を使い単純一致を防ぐ（空白/大文字小文字/全角半角の正規化）。
- タイトルが複数含まれる場合の処理方針を事前に定めておく（例: 最初のマッチを採用、残りは `notes` に追記）。
- `SUPABASE_SERVICE_ROLE_KEY` は絶対にクライアントに渡さない。

---

## 実装者向け短期実行チェックリスト

- [ ] Supabase にテーブルを作成
- [ ] Next.js プロジェクトを用意
- [ ] `lib/supabaseServer.ts` と `lib/extractMovieTitle.ts` を追加
- [ ] `app/api/sync/route.ts` を実装して動作確認
- [ ] GitHub Actions / Vercel Cron を設定して定期実行
- [ ] UI（チェックイン一覧・映画一覧）を最小実装

---

## 参考（メモ）

- Swarm / Foursquare API ドキュメントを実装前に再確認すること
- TMDB API の利用には API キーが必要（利用規約遵守）

---

以上が Cinema Swarm Log の実装に必要な詳細仕様書です。実装テンプレート（ファイル作成や更に詳細な UI コンポーネント雛形）をこのリポジトリに追加する場合は、次にどのファイルを作成してほしいか指示してください。
