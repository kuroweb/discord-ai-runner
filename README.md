# discord-ai-runner

Discordメンションを起点にスレッドを作成し、AI応答を継続するBot。
本番常駐は `launchd`（macOS LaunchDaemon）を前提にしている。

## 機能

- チャンネルでBotをメンションすると、その会話用のスレッドを作成して応答を開始
- 作成したスレッドでは、以降のメッセージをメンションなしで継続処理
- スラッシュコマンドでセッション、モデル、作業ディレクトリを確認・切り替え
- スレッドごとのセッション状態と、チャンネルごとの既定設定を永続化

## ディレクトリ構成

| パス           | 用途                        |
| -------------- | --------------------------- |
| `src/`         | Bot 本体のソースコード      |
| `agent-tools/` | エージェント向けCLIツール群 |
| `launchd/`     | `launchd` 用 plist          |
| `scripts/`     | ビルド補助スクリプト        |
| `dist/`        | ビルド成果物                |
| `logs/`        | 実行ログの出力先            |

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

| 変数                       | 必須 | 説明                                                        |
| -------------------------- | ---- | ----------------------------------------------------------- |
| `DISCORD_TOKEN`            | 必須 | Discord Bot Token                                           |
| `AI_ADAPTER`               | 任意 | 使用するアダプタ。`claude` がデフォルト、`codex` も指定可能 |
| `ANTHROPIC_MODELS_API_KEY` | 任意 | `/models` で Anthropic モデル一覧を取得するときに使用       |
| `OPENAI_MODELS_API_KEY`    | 任意 | `AI_ADAPTER=codex` で `/models` を使うときに使用            |

スラッシュコマンドはグローバル登録されるため、Discord 側への反映に時間がかかることがある。

## スラッシュコマンド

| コマンド                        | 実行場所                   | 概要                                                                                                                      |
| ------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `/status`                       | スレッド内<br>チャンネル内 | スレッド内では現在の利用状況、チャンネル内ではそのチャンネルの既定設定を表示                                              |
| `/session [id]`                 | スレッド内                 | 現在のセッション ID を表示。`id` 指定時はそのセッションへ切り替え                                                         |
| `/sessions`                     | スレッド内<br>チャンネル内 | 現在の作業ディレクトリにあるセッション一覧を表示                                                                          |
| `/model [id]`                   | スレッド内<br>チャンネル内 | `id` 未指定なら現在値を表示。スレッド内ではそのスレッドのモデル、チャンネル内では新規スレッド向けのデフォルトモデルを設定 |
| `/models`                       | スレッド内<br>チャンネル内 | リモートのモデル一覧を表示し、選択でモデルを設定                                                                          |
| `/reset`                        | スレッド内                 | 現在のスレッドのセッションと、そのスレッド専用の作業ディレクトリ設定をリセット                                            |
| `/close`                        | スレッド内                 | 現在のスレッドを閉じる                                                                                                    |
| `/cwd [path]`                   | スレッド内<br>チャンネル内 | `path` 未指定なら現在値を表示。`path` 指定時は作業ディレクトリを設定し、スレッド内ではセッションもリセット                |
| `/sync-thread-name`             | スレッド内                 | 現在のセッション summary を使ってスレッド名を更新。AI アダプタが summary 取得に未対応の場合は利用不可                     |
| `/diff-preview-html [file]`     | スレッド内                 | 現在の作業ディレクトリの `git diff` を HTML 添付で返す。`file` 指定時はその相対パスの差分のみ対象                         |
| `/diff-preview-markdown [file]` | スレッド内                 | 現在の作業ディレクトリの `git diff` を Markdown コードブロックで返す。`file` 指定時はその相対パスの差分のみ対象           |

## npm scripts

| コマンド                    | 用途                                                          |
| --------------------------- | ------------------------------------------------------------- |
| `npm run dev`               | 開発起動                                                      |
| `npm run lint`              | Lint 実行                                                     |
| `npm run lint:fix`          | Lint の自動修正                                               |
| `npm run format:check`      | Prettier のチェック                                           |
| `npm run format`            | Prettier 実行                                                 |
| `npm run build`             | 本体のビルドと `agent-tools/` 配下のビルドを実行              |
| `npm run build:agent-tools` | `agent-tools/` 配下で `build` script を持つツールだけをビルド |
| `npm run start`             | ビルド済み成果物で単発起動                                    |

## agent-tools

`agent-tools/` は、Bot 本体とは分離したエージェント向けCLIツール群の置き場。
エージェントは必要に応じて `agent-tools/README.md` を確認し、`agent-tools/bin/<tool-name>` を直接実行する。

最初のサンプルとして `agent-tools/diff-preview-html/` を含む。

## launchd 運用

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
- `/models` でモデル一覧を取得できない
  - `AI_ADAPTER` に応じて `ANTHROPIC_MODELS_API_KEY` または `OPENAI_MODELS_API_KEY` を設定しているか確認
- スラッシュコマンドが表示されない
  - Discord クライアントをリロードして再確認
