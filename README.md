# QPI 統合ガントチャート（共有Webアプリケーション）

複数人でリアルタイムに閲覧・共同編集できるガントチャートWebアプリケーションです。

## 特徴
- **自動ステータス・残日数判定**: 基準日（`TODAY()`）に応じて「遅延」「期限間近」「進行中」「開始前」「継続中」を自動計算・色分け
- **リアルタイム同期**: 誰かが追加・編集・削除した内容が自動でサーバー（JSON/DB）に保存され、全メンバーの画面に同期
- **絞り込み・検索**: 担当者別、キーワード検索、状態別（KPIボタンクリック）で瞬時にフィルタリング
- **階層管理**: 大項目 ＞ 中項目 ＞ 小項目（タスク）のツリー管理とワンクリック開閉

---

## クラウド（Render）への無料公開手順（おすすめ）

### 1. GitHubリポジトリを作成
1. [GitHub](https://github.com/) にログインし、「**New repository**」をクリック
2. リポジトリ名（例: `qpi-gantt-app`）を入力して「Create repository」
3. このプロジェクトフォルダの全ファイルをリポジトリにアップロード（または `git push`）

### 2. Render に無料デプロイ
1. [Render](https://render.com/) にアクセスし、GitHubアカウントで無料登録・ログイン
2. ダッシュボードで「**New +**」＞「**Web Service**」を選択
3. 作成した GitHub リポジトリ（`qpi-gantt-app`）を選択
4. 設定項目：
   - **Name**: `qpi-gantt`（任意）
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free`
5. 「**Create Web Service**」をクリック

数分でビルドが完了し、`https://qpi-gantt-xxxx.onrender.com` のような専用URLが発行されます。このURLをチームメンバーに共有すれば、誰でも即座にブラウザから共同編集できるようになります！
