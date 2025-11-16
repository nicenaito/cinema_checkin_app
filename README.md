# Cinema Swarm Log

簡易 README — ローカル実行手順と Supabase のセットアップをまとめています。

## 必要な環境
- Node.js >= 18
- pnpm / npm / yarn
- Supabase プロジェクト

## ローカルセットアップ

1. 依存インストール

```bash
pnpm install
```

2. 環境変数（ローカル）

プロジェクトルートに `.env.local` を作成し、以下を設定してください。

```
SWARM_API_TOKEN=your_swarm_token
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ADMIN_TOKEN=some-secret (任意)
```

3. Supabase にテーブルを作成
- `Cinema_Swarm_Log_SPEC.md` にある SQL を Supabase の SQL エディタで実行してください。

4. 開発サーバ起動

```bash
pnpm dev
```

5. テスト

```bash
pnpm test
```

## デプロイ
- Vercel に GitHub リポジトリを接続し、Environment Variables を設定してください（`SWARM_API_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_TOKEN`）。
- Cron は Vercel のスケジュール機能、または GitHub Actions を使って `/api/sync` を叩いてください。

---

詳細は `Cinema_Swarm_Log_SPEC.md` を参照してください。
