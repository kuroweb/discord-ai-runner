# discord-ai-runner

Discordメンションを起点にスレッドを作成し、AI応答を継続するBot。
本番常駐は `launchd`（macOS LaunchDaemon）を前提にしている。

## 機能

- チャンネルでBotをメンションすると新規スレッドを作成
  - スレッド名は `[日時] 要望（先頭20文字）` 形式で自動生成
- 以降はスレッド内メッセージをメンションなしで処理
- スレッド内スラッシュコマンド
- `/cwd [path]`: スレッドごとの作業ディレクトリを表示または設定。変更時はセッションもリセット
  - `/reset`: セッションと作業ディレクトリを初期化
  - `/status`: 直近利用状況を表示
- 永続化ファイル
  - `.state.json`: 管理中スレッドとセッション情報

## 前提環境

- macOS
- Node.js（推奨: Homebrew環境）
- npm
- Discord Bot Token

## 開発セットアップ

### 1. リポジトリ取得

```bash
git clone <REMOTE_URL> /Users/user/environment/discord-ai-runner
cd /Users/user/environment/discord-ai-runner
```

`<REMOTE_URL>` は利用中の Git リモート URL に置き換える。

### 2. 依存関係のインストール

```bash
npm install
cp .env.example .env
```

### 3. 環境変数の設定

`.env`:

```bash
DISCORD_TOKEN=your_bot_token_here
AI_ADAPTER=claude
DISCORD_GUILD_ID=your_guild_id_here
```

`AI_ADAPTER` は `claude`（デフォルト）か `codex`。
`DISCORD_GUILD_ID` を設定すると slash command を guild 単位で即時反映する。未設定時は global 登録になり、Discord 側の反映に時間がかかることがある。

### 4. 起動確認

開発起動:

```bash
npm run dev
```

Lint:

```bash
npm run lint
```

Format check:

```bash
npm run format:check
```

Format:

```bash
npm run format
```

ビルド:

```bash
npm run build
```

本番相当の単発起動（ビルド済み成果物）:

```bash
npm run start
```

## launchd 運用セットアップ

`launchd/` 配下の plist は、`codex` / `claude` を別サービスとして常駐させる運用を想定している。
その場合は同一リモートを 2 ディレクトリに展開して使う。

```bash
git clone <REMOTE_URL> /Users/user/environment/discord-ai-runner-codex
git clone <REMOTE_URL> /Users/user/environment/discord-ai-runner-claude
```

### 1. クローン先パスの確認

`launchd/com.discord-ai-runner-codex.plist` と `launchd/com.discord-ai-runner-claude.plist` は、次の絶対パスを前提にしている。

- codex: `/Users/user/environment/discord-ai-runner-codex`
- claude: `/Users/user/environment/discord-ai-runner-claude`

クローン先ディレクトリ名や配置先を変える場合は、導入前に両 plist の次のキーを実環境に合わせて修正する。

- `UserName`
- `WorkingDirectory`
- `StandardOutPath`
- `StandardErrorPath`

構文確認:

```bash
plutil -lint launchd/com.discord-ai-runner-codex.plist launchd/com.discord-ai-runner-claude.plist
```

### 2. サービス導入（codex）

```bash
mkdir -p /Users/user/environment/discord-ai-runner-codex/logs
sudo cp launchd/com.discord-ai-runner-codex.plist /Library/LaunchDaemons/com.discord-ai-runner-codex.plist
sudo chown root:wheel /Library/LaunchDaemons/com.discord-ai-runner-codex.plist
sudo chmod 644 /Library/LaunchDaemons/com.discord-ai-runner-codex.plist
sudo launchctl bootstrap system /Library/LaunchDaemons/com.discord-ai-runner-codex.plist
sudo launchctl enable system/com.discord-ai-runner-codex
sudo launchctl kickstart -k system/com.discord-ai-runner-codex
```

### 3. サービス導入（claude）

```bash
mkdir -p /Users/user/environment/discord-ai-runner-claude/logs
sudo cp launchd/com.discord-ai-runner-claude.plist /Library/LaunchDaemons/com.discord-ai-runner-claude.plist
sudo chown root:wheel /Library/LaunchDaemons/com.discord-ai-runner-claude.plist
sudo chmod 644 /Library/LaunchDaemons/com.discord-ai-runner-claude.plist
sudo launchctl bootstrap system /Library/LaunchDaemons/com.discord-ai-runner-claude.plist
sudo launchctl enable system/com.discord-ai-runner-claude
sudo launchctl kickstart -k system/com.discord-ai-runner-claude
```

## launchd 運用コマンド

### 状態確認

```bash
sudo launchctl print system/com.discord-ai-runner-codex | rg "state =|pid =|last exit code"
sudo launchctl print system/com.discord-ai-runner-claude | rg "state =|pid =|last exit code"
```

### ログ確認

```bash
tail -f /Users/user/environment/discord-ai-runner-codex/logs/launchd.out.log /Users/user/environment/discord-ai-runner-codex/logs/launchd.err.log
tail -f /Users/user/environment/discord-ai-runner-claude/logs/launchd.out.log /Users/user/environment/discord-ai-runner-claude/logs/launchd.err.log
```

### 再起動

```bash
sudo launchctl kickstart -k system/com.discord-ai-runner-codex
sudo launchctl kickstart -k system/com.discord-ai-runner-claude
```

### plist 変更反映（codex）

```bash
sudo launchctl bootout system/com.discord-ai-runner-codex
sudo cp launchd/com.discord-ai-runner-codex.plist /Library/LaunchDaemons/com.discord-ai-runner-codex.plist
sudo chown root:wheel /Library/LaunchDaemons/com.discord-ai-runner-codex.plist
sudo chmod 644 /Library/LaunchDaemons/com.discord-ai-runner-codex.plist
sudo launchctl bootstrap system /Library/LaunchDaemons/com.discord-ai-runner-codex.plist
sudo launchctl enable system/com.discord-ai-runner-codex
sudo launchctl kickstart -k system/com.discord-ai-runner-codex
```

### plist 変更反映（claude）

```bash
sudo launchctl bootout system/com.discord-ai-runner-claude
sudo cp launchd/com.discord-ai-runner-claude.plist /Library/LaunchDaemons/com.discord-ai-runner-claude.plist
sudo chown root:wheel /Library/LaunchDaemons/com.discord-ai-runner-claude.plist
sudo chmod 644 /Library/LaunchDaemons/com.discord-ai-runner-claude.plist
sudo launchctl bootstrap system /Library/LaunchDaemons/com.discord-ai-runner-claude.plist
sudo launchctl enable system/com.discord-ai-runner-claude
sudo launchctl kickstart -k system/com.discord-ai-runner-claude
```

### 停止 / 無効化

```bash
sudo launchctl bootout system/com.discord-ai-runner-codex
sudo launchctl disable system/com.discord-ai-runner-codex
sudo launchctl bootout system/com.discord-ai-runner-claude
sudo launchctl disable system/com.discord-ai-runner-claude
```

## デプロイ後の反映

```bash
cd /Users/user/environment/discord-ai-runner-codex
git pull --ff-only
npm install
npm run build

cd /Users/user/environment/discord-ai-runner-claude
git pull --ff-only
npm install
npm run build

sudo launchctl kickstart -k system/com.discord-ai-runner-codex
sudo launchctl kickstart -k system/com.discord-ai-runner-claude
```

## トラブルシュート

- `DISCORD_TOKEN が設定されていません`
  - `.env` に `DISCORD_TOKEN` が設定されているか確認
- 反応しない
  - `launchctl print` で `state = running` を確認
  - `logs/launchd.err.log` を確認
- 想定外の挙動が残る
  - `.state.json` をバックアップして削除後、再起動して再検証
