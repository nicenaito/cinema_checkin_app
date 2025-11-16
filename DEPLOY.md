# デプロイ手順（Vercel + GitHub Actions）

このドキュメントは `cinema-swarm-log` を Vercel にデプロイする手順と、Supabase の初期設定・環境変数の登録方法をまとめたものです。

## 1. 事前準備
- Node.js (推奨 18+)
- GitHub アカウント
- Vercel アカウント
- Supabase プロジェクト

## 2. Supabase の初期設定
1. Supabase にログインしてプロジェクトを作成
2. SQL エディタで `Cinema_Swarm_Log_SPEC.md` に記載のテーブル作成 SQL を実行
3. Supabase の Settings -> API から以下を控える
   - SUPABASE_URL (例: https://xxxx.supabase.co)
   - SUPABASE_SERVICE_ROLE_KEY (service_role)

> 注意: `SUPABASE_SERVICE_ROLE_KEY` は強力な権限を持つキーです。絶対に公開リポジトリやクライアントに含めないでください。

## 3. GitHub にリポジトリを作成してコードをプッシュ
1. リポジトリを作成し、ローカルで下記を実行

```bash
git init
git add .
git commit -m "init: cinema swarm log"
# create repo on GitHub and push
git remote add origin git@github.com:<your_org_or_user>/cinema-swarm-log.git
git push -u origin main
```

## 4. Vercel での設定
1. Vercel にログインして「Import Project」から GitHub リポジトリをインポート
2. Build & Output 設定は通常の Next.js デフォルト（Build Command: `pnpm build` / Output Directory: `.next`）で問題ありません
3. Environment Variables を追加
   - `SWARM_API_TOKEN` = (Swarm のアクセストークン)
   - `SUPABASE_URL` = (Supabase URL)
   - `SUPABASE_SERVICE_ROLE_KEY` = (Supabase service role key)
   - `ADMIN_TOKEN` = (任意: 内部API保護用のトークン)
   - `DEPLOYMENT_URL` = (optional) https://your-deployment.vercel.app  — GitHub Actions から使う場合は Secrets 側で設定するか、Actions 側に `DEPLOYMENT_URL` を Secret として入れてください

4. デプロイを実行し、Web が公開されることを確認

## 5. GitHub Actions (定期実行) の設定
1. このリポジトリには `.github/workflows/sync.yml` が含まれています。
2. GitHub リポジトリの Settings -> Secrets and variables -> Actions に以下の Secret を登録
   - `ADMIN_TOKEN` = 同じ値を Vercel の `ADMIN_TOKEN` と合わせてください
   - `DEPLOYMENT_URL` = `https://<your-deployment>.vercel.app`

3. Actions のスケジュールにより毎日 `/api/sync` を呼び出します。手動で動作確認したい場合は GitHub 上で workflow_dispatch を使うか、ローカルから `curl` で保護ヘッダを付けて叩いてください。

```bash
curl -H "x-admin-token: $ADMIN_TOKEN" "https://your-deployment.vercel.app/api/sync"
```

## 6. Vercel Cron（代替）
- Vercel が Cron をサポートしている場合、Vercel Dashboard の「Cron Jobs」機能で `GET https://<your-deployment>/api/sync` を設定してもよいです。

## 7. ローカルでの動作確認
1. `.env.local` を作成して環境変数を設定

```
SWARM_API_TOKEN=your_swarm_token
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ADMIN_TOKEN=some-secret
```

2. 依存をインストールして開発サーバを起動

```bash
pnpm install
pnpm dev
```

3. ブラウザで `http://localhost:3000` を開き、`/api/sync` を手動で叩くか UI の同期ボタンを使って動作確認

## 8. 運用上の注意
- `SUPABASE_SERVICE_ROLE_KEY` を流出させないこと
- Swarm API のレート制限やエラー時の再試行（指数バックオフ）を実装すること
- 定期ジョブに失敗した場合は Alerts（メール／Slack）を設定すること（必要に応じて）

---

必要なら Vercel の Protect by Password（Preview 環境の保護）や Basic Auth を追加するガイドも作成できます。