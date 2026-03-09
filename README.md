# discord-ai-runner

Discordメンションを起点にスレッドを作成し、AI応答を継続するBot。
本番常駐は `launchd`（macOS LaunchDaemon）を前提にしている。

## 機能

- チャンネルでBotをメンションすると新規スレッドを作成
  - スレッド名は `[日時] 要望（先頭20文字）` 形式で自動生成
- 以降はスレッド内メッセージをメンションなしで処理
- スレッド内スラッシュコマンド
  - `/cwd [path]`: スレッドごとの作業ディレクトリを表示または設定
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

同一リモートを `codex` 用と `claude` 用の2ディレクトリにクローンする。

```bash
git clone <REMOTE_URL> /Users/user/environment/discord-ai-runner-codex
git clone <REMOTE_URL> /Users/user/environment/discord-ai-runner-claude
```

`<REMOTE_URL>` は利用中の Git リモート URL に置き換える。

### 2. 依存関係のインストール

```bash
cd /Users/user/environment/discord-ai-runner-codex
npm install
cp .env.example .env
```

必要に応じて `claude` 側も同様に実施:

```bash
cd /Users/user/environment/discord-ai-runner-claude
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

ビルド:

```bash
npm run build
```

本番相当の単発起動（ビルド済み成果物）:

```bash
npm run start
```

## launchd 運用セットアップ

同一リポジトリ内の plist を使って、`codex` / `claude` を別サービスとして登録する。

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
git pull
npm install
npm run build
sudo launchctl kickstart -k system/com.discord-ai-runner-codex
sudo launchctl kickstart -k system/com.discord-ai-runner-claude
```

## Claude Hook によるガードレール設定

`--dangerously-skip-permissions` を前提とした Claude 実行に対し、`.claude` の PreToolUse Hook で Bash コマンドを事前検査するガードレールを提供する。

### ファイル構成

```text
.claude/
├── settings.json                 # 必須・共有（Git管理）
├── settings.local.json.example   # ローカル上書きサンプル（Git管理）
├── settings.local.json           # ローカル上書き（.gitignore 除外）
└── hooks/
    └── deny-check.sh             # Bash コマンド検査スクリプト
```

### 初回セットアップ

```bash
# ローカル設定ファイルを作成（任意）
cp .claude/settings.local.json.example .claude/settings.local.json
```

### 拒否対象コマンド

| パターン | 理由 |
| --- | --- |
| `sudo *` | 権限昇格 |
| `rm -rf /` | ルートディレクトリ以下の全削除 |
| `curl * \| sh` | 任意スクリプトの即時実行 |
| `wget * \| sh` | 任意スクリプトの即時実行 |

### 動作確認

```bash
# jq が必要（未インストールの場合は deny される）
which jq || brew install jq

# スクリプトの実行権限確認
ls -la .claude/hooks/deny-check.sh

# 手動テスト（許可されるコマンド）：exit 0
echo '{"tool_input":{"command":"ls -la"}}' | bash .claude/hooks/deny-check.sh; echo "exit: $?"
# => exit: 0

# 手動テスト（拒否されるコマンド）：stderr にメッセージ + exit 2
echo '{"tool_input":{"command":"sudo echo test"}}' | bash .claude/hooks/deny-check.sh; echo "exit: $?"
# => Dangerous command detected
# => exit: 2
```

### ログ確認

デフォルトは**無効**。`.env` で有効化する。

```bash
HOOK_LOG=true
```

有効化後、`logs/deny-check.log` に出力される（1行1JSON）。

```json
{"timestamp":"2026-03-07T05:47:53Z","decision":"allow","command":"echo test"}
{"timestamp":"2026-03-07T05:49:17Z","decision":"deny","reason":"Dangerous command detected","command":"sudo echo test"}
{"timestamp":"2026-03-07T05:49:19Z","decision":"allow","command":"tail -1 logs/deny-check.log | jq ."}
```

| フィールド | 内容 |
| --- | --- |
| `timestamp` | UTC タイムスタンプ（ISO 8601） |
| `decision` | `allow` または `deny` |
| `reason` | 拒否理由（deny のみ） |
| `command` | 検査対象コマンド |

```bash
tail -f logs/deny-check.log
```

### Hook の無効化

Hook を無効化する場合は `settings.json` の `hooks` セクションを削除または空配列に変更する。`settings.local.json` での上書きは必須 deny ルールを無効化しない範囲に限定すること。

## トラブルシュート

- `DISCORD_TOKEN が設定されていません`
  - `.env` に `DISCORD_TOKEN` が設定されているか確認
- 反応しない
  - `launchctl print` で `state = running` を確認
  - `logs/launchd.err.log` を確認
- 想定外の挙動が残る
  - `.state.json` をバックアップして削除後、再起動して再検証
