---
root: true
targets: ["*"]
description: "discord-ai-runner のプロジェクト概要と開発ルール"
globs: ["**/*"]
---

# プロジェクト概要

`discord-ai-runner` は、Discord メンションを起点に会話スレッドを作成し、AI 応答を継続する Bot。
本番常駐は macOS の `launchd` を前提とする。

## 主要機能

- メンション時に会話用スレッドを自動作成して応答開始
- 作成済みスレッドではメンションなしで継続応答
- スラッシュコマンドでセッション / モデル / 作業ディレクトリを確認・切り替え
- スレッド単位の状態とチャンネル既定設定を永続化

## 技術スタック

- Runtime: Node.js
- Language: TypeScript
- Package manager: npm
- Platform: macOS（`launchd` 運用）

## ディレクトリ構成

- `src/`: Bot 本体
- `agent-tools/`: エージェント向け CLI ツール
- `.rulesync/`: ルール・スキルの編集正本
- `scripts/`: ビルド補助スクリプト
- `launchd/`: LaunchDaemon 用 plist
- `dist/`: ビルド成果物
- `logs/`: 実行ログ

## AI エージェント設定

### rulesync で共通管理

`.rulesync/` で編集し、`rulesync generate` で各エージェント向けに展開する。

| 編集正本 | Claude Code | Codex |
| --- | --- | --- |
| `.rulesync/rules/` | `.claude/rules` | `.codex/memories` |
| `.rulesync/rules/overview.md` | `CLAUDE.md` | `AGENTS.md` |
| `.rulesync/skills/` | `.claude/skills` | `.codex/skills` |

## 開発ルール

- 既存の npm scripts（`dev`, `build`, `lint`, `format:check` など）を優先して利用する。
- 環境変数は `.env.example` を基準にし、機密情報はコミットしない。
- スレッド/セッション/モデル/CWD 周りの挙動を変更する場合は、関連コマンド（`/status`, `/session`, `/model`, `/cwd`, `/reset` など）への影響を確認する。
- `agent-tools` を更新する場合は、Bot 本体との依存関係とビルド導線（`npm run build:agent-tools`）を壊さない。
- skill は `.rulesync/skills/` を編集正本とし、`rulesync generate` で各エージェント向けディレクトリへ反映する。

## 運用メモ

- デプロイ後は `git pull --ff-only` → `npm install` → `npm run build` の順で反映する。
- `launchd` 運用時は plist のパス設定（`WorkingDirectory`, `StandardOutPath`, `StandardErrorPath` など）を実環境に合わせる。
