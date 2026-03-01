# discord-ai-runner

Discordメンションを起点にスレッドを作成し、AI応答を継続するBot。
本番常駐は `launchd`（macOS LaunchDaemon）を前提にしている。

## 仕様

- チャンネルでBotをメンションすると新規スレッドを作成
- 以降はスレッド内メッセージをメンションなしで処理
- スレッド内コマンド
  - `!reset`: セッションを初期化
  - `!status`: 直近利用状況を表示
- 永続化ファイル
  - `.state.json`: 管理中スレッドとセッション情報

## 必要環境

- macOS
- Node.js（推奨: Homebrew環境）
- npm
- Discord Bot Token

## セットアップ

```bash
npm install
cp .env.example .env
```

`.env`:

```bash
DISCORD_TOKEN=your_bot_token_here
AI_ADAPTER=claude
```

`AI_ADAPTER` は `claude`（デフォルト）か `codex`。

## ローカル起動

```bash
npm run dev
```

本番相当の単発起動:

```bash
npm run start
```

## launchd 常駐運用

### 初回導入

```bash
mkdir -p /Users/user/environment/discord-ai-runner-codex/logs
sudo cp launchd/com.discord-ai-runner.plist /Library/LaunchDaemons/com.discord-ai-runner.plist
sudo chown root:wheel /Library/LaunchDaemons/com.discord-ai-runner.plist
sudo chmod 644 /Library/LaunchDaemons/com.discord-ai-runner.plist
sudo launchctl bootstrap system /Library/LaunchDaemons/com.discord-ai-runner.plist
sudo launchctl enable system/com.discord-ai-runner
sudo launchctl kickstart -k system/com.discord-ai-runner
```

### 状態確認

```bash
sudo launchctl print system/com.discord-ai-runner | rg "state =|pid =|last exit code"
```

### ログ確認

```bash
tail -f logs/launchd.out.log logs/launchd.err.log
```

### 再起動

```bash
sudo launchctl kickstart -k system/com.discord-ai-runner
```

### plist変更の反映

```bash
sudo launchctl bootout system/com.discord-ai-runner
sudo cp launchd/com.discord-ai-runner.plist /Library/LaunchDaemons/com.discord-ai-runner.plist
sudo chown root:wheel /Library/LaunchDaemons/com.discord-ai-runner.plist
sudo chmod 644 /Library/LaunchDaemons/com.discord-ai-runner.plist
sudo launchctl bootstrap system /Library/LaunchDaemons/com.discord-ai-runner.plist
sudo launchctl enable system/com.discord-ai-runner
sudo launchctl kickstart -k system/com.discord-ai-runner
```

### 停止 / 無効化

```bash
sudo launchctl bootout system/com.discord-ai-runner
sudo launchctl disable system/com.discord-ai-runner
```

## コード差分をデーモンに反映

```bash
git pull
npm install
sudo launchctl kickstart -k system/com.discord-ai-runner
```

## トラブルシュート

- `DISCORD_TOKEN が設定されていません`
  - `.env` に `DISCORD_TOKEN` が入っているか確認
- 反応しない
  - `launchctl print` で `state = running` を確認
  - `logs/launchd.err.log` を確認
- 想定外の挙動が残る
  - `.state.json` をバックアップして削除後、再起動して再検証
